import firebase_admin
from firebase_admin import credentials, storage, firestore
import tempfile
import os
import subprocess
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://YOUR_APP.firebaseio.com',
})

db = firestore.client()
bucket = storage.bucket('YOUR_APP.firebasestorage.app')


def process_task(task_id, task_data):
    # Cria diretório temporário para trabalhar com os arquivos
    with tempfile.TemporaryDirectory() as temp_dir:
        ifc_path = os.path.join(temp_dir, 'model.ifc')
        gltf_path = os.path.join(temp_dir, 'model.gltf')

        logger.info(f"IFC path: {ifc_path}")
        logger.info(f"GLTF path: {gltf_path}")

        try:
            # Baixa o arquivo IFC do Firebase Storage
            blob = bucket.blob(task_data['filePath'])
            blob.download_to_filename(ifc_path)
            logger.info(f"File downloaded to: {ifc_path}")

            # Verifica se download funcionou
            if not os.path.exists(ifc_path):
                raise FileNotFoundError(f"IFC file not found at {ifc_path}")

            # Executa o Blender em modo background com comando Python
            logger.info("Running Blender conversion...")
            result = subprocess.run([
                'blender',
                '--background',
                '--python-expr',
                f"""
import bpy
import os
import addon_utils

# Enable GLTF addon
addon_utils.enable('io_scene_gltf2', default_set=True, persistent=True)

# Clear scene
bpy.ops.wm.read_homefile(use_empty=True)

# Import IFC
bpy.ops.bim.load_project(filepath='{ifc_path}')

# Export GLTF
bpy.ops.export_scene.gltf(
    filepath='{gltf_path}',
    check_existing=False,
    export_format='GLTF_SEPARATE',  # Changed from GLTF_EMBEDDED to GLTF_SEPARATE
    use_selection=False
)
                """
            ], check=True, capture_output=True, text=True)

            logger.info(f"Blender output: {result.stdout}")
            if result.stderr:
                logger.warning(f"Blender stderr: {result.stderr}")

            # Verifica se houve erro na execução do Blender
            if not os.path.exists(gltf_path):
                raise FileNotFoundError(f"GLTF not generated at {gltf_path}")

            # Upload do arquivo GLTF
            processed_path = f"processed/{task_id}.gltf"
            blob = bucket.blob(processed_path)
            blob.upload_from_filename(gltf_path)

            # Se tiver arquivos adicionais (.bin), fazer upload também
            bin_path = gltf_path.replace('.gltf', '.bin')
            if os.path.exists(bin_path):
                bin_blob = bucket.blob(f"processed/{task_id}.bin")
                bin_blob.upload_from_filename(bin_path)

            # Atualiza status do task no Firestore
            db.collection('tasks').document(task_id).update({
                'status': 'processed',
                'processedPath': processed_path
            })

            logger.info(f"Task {task_id} completed successfully")

        except Exception as e:
            logger.error(f"Error processing task {task_id}: {str(e)}")
            if 'result' in locals() and result.stderr:
                logger.error(f"Blender error output: {result.stderr}")
            db.collection('tasks').document(task_id).update({
                'status': 'error',
                'error': str(e)
            })


def main():
    while True:
        try:
            tasks = db.collection('tasks').where(
                'status', '==', 'pending').stream()
            for doc in tasks:
                logger.info(f"Processing task: {doc.id}")
                process_task(doc.id, doc.to_dict())

        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
            break

        except Exception as e:
            logger.error(f"Main loop error: {str(e)}")

        time.sleep(10)


if __name__ == "__main__":
    main()
