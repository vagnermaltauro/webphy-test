import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DRACOLoader } from 'three/examples/jsm/Addons.js';

interface ModelViewerProps {
    modelUrl: string;
}

export default function ModelViewer({ modelUrl }: ModelViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !modelUrl) return;

        const loadModel = async () => {
            try {
                // Busca o GLTF do modelo
                const gltfResponse = await fetch(`/api/model?url=${encodeURIComponent(modelUrl)}`);
                const gltfContent = await gltfResponse.json();

                if (gltfContent.buffers && gltfContent.buffers[0]) {
                    // Obter URL do binário
                    const binUrl = modelUrl.replace('.gltf', '.bin');
                    console.log('Fetching binary from:', binUrl);

                    // Busca o binário do modelo
                    const binResponse = await fetch(`/api/model?url=${encodeURIComponent(binUrl)}`);
                    const binData = await binResponse.arrayBuffer();

                    // Cria blob URL para o binário
                    const binBlob = new Blob([binData], { type: 'application/octet-stream' });
                    const binBlobUrl = URL.createObjectURL(binBlob);
                    gltfContent.buffers[0].uri = binBlobUrl;
                }

                // Cria blob URL para o GLTF
                const gltfBlob = new Blob([JSON.stringify(gltfContent)], { type: 'model/gltf+json' });
                const gltfBlobUrl = URL.createObjectURL(gltfBlob);

                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0xf0f0f0);

                const camera = new THREE.PerspectiveCamera(
                    75,
                    container.clientWidth / container.clientHeight,
                    0.1,
                    1000
                );
                camera.position.z = 5;

                const renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true
                });

                // tamanho do renderizador
                renderer.setSize(container.clientWidth, container.clientHeight);
                // ajustar a densidade de pixels do dispositivo
                renderer.setPixelRatio(window.devicePixelRatio);
                // habilitar sombras
                renderer.shadowMap.enabled = true;
                // adicionar ao container
                container.appendChild(renderer.domElement);

                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.screenSpacePanning = true;

                // iluminação do ambeinte
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                directionalLight.position.set(5, 5, 5);
                directionalLight.castShadow = true;
                scene.add(directionalLight);

                const loader = new GLTFLoader();
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
                loader.setDRACOLoader(dracoLoader);

                loader.load(
                    gltfBlobUrl,
                    (gltf) => {
                        // Adiciona o modelo na cena
                        scene.add(gltf.scene);

                        // Calcula o centro e tamanho do modelo
                        const box = new THREE.Box3().setFromObject(gltf.scene);
                        const center = box.getCenter(new THREE.Vector3());
                        const size = box.getSize(new THREE.Vector3());

                        console.log({ center, size });

                        // Centraliza o modelo
                        gltf.scene.position.x = -center.x;
                        gltf.scene.position.y = -center.y;
                        gltf.scene.position.z = -center.z;

                        // Calcula a distância para a câmera
                        const maxDim = Math.max(size.x, size.y, size.z);
                        const distance = maxDim * 2;

                        // Atualiza a câmera
                        camera.position.set(distance, distance, distance);
                        camera.lookAt(new THREE.Vector3(0, 0, 0));
                        camera.near = 0.1;
                        camera.far = distance * 4;
                        camera.updateProjectionMatrix();

                        // Atualiza os controles
                        controls.target.set(0, 0, 0);
                        controls.maxDistance = distance * 2;
                        controls.minDistance = maxDim / 10;
                        controls.update();

                        // Adiciona grid e eixos
                        const gridHelper = new THREE.GridHelper(maxDim * 2, 20);
                        scene.add(gridHelper);

                        const axesHelper = new THREE.AxesHelper(maxDim);
                        scene.add(axesHelper);

                        // Adiciona novas luzes ajustadas
                        scene.remove(ambientLight);
                        scene.remove(directionalLight);

                        const newAmbientLight = new THREE.AmbientLight(0xffffff, 0.8);
                        scene.add(newAmbientLight);

                        const newDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
                        newDirectionalLight.position.set(distance, distance, distance);
                        newDirectionalLight.castShadow = true;
                        newDirectionalLight.shadow.mapSize.width = 2048;
                        newDirectionalLight.shadow.mapSize.height = 2048;
                        newDirectionalLight.shadow.camera.near = 0.1;
                        newDirectionalLight.shadow.camera.far = distance * 4;
                        scene.add(newDirectionalLight);

                        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
                        scene.add(hemisphereLight);

                        setLoading(false);
                    },
                    (error) => {
                        console.error('Error loading model:', error);
                        setError('Failed to load 3D model');
                        setLoading(false);
                    }
                );

                // Atualizar a cena e renderizar
                let animationFrameId: number;
                const animate = () => {
                    animationFrameId = requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                };
                animate();

                //  Redimensionar o renderizador
                const handleResize = () => {
                    if (!container) return;
                    camera.aspect = container.clientWidth / container.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(container.clientWidth, container.clientHeight);
                };
                window.addEventListener('resize', handleResize);

                return () => {
                    window.removeEventListener('resize', handleResize);
                    cancelAnimationFrame(animationFrameId);
                    URL.revokeObjectURL(gltfBlobUrl);
                    if (gltfContent.buffers?.[0]?.uri.startsWith('blob:')) {
                        URL.revokeObjectURL(gltfContent.buffers[0].uri);
                    }
                    dracoLoader.dispose();
                    renderer.dispose();
                    scene.clear();
                    if (container.contains(renderer.domElement)) {
                        container.removeChild(renderer.domElement);
                    }
                };
            } catch (error) {
                console.error('Error setting up model:', error);
                setError('Failed to setup 3D viewer');
                setLoading(false);
            }
        };

        loadModel();
    }, [modelUrl]);

    return (
        <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
            <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'none' }} />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-white text-xl flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Loading model...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/50">
                    <div className="text-white text-xl">{error}</div>
                </div>
            )}
        </div>
    );
}
