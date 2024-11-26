import { db, storage } from "@/config/firebase.config";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';

export default function FileUpload() {
    const [uploading, setUploading] = useState(false);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".ifc")) {
            alert("Selecione um arquivo no formato IFC!");
            return;
        }

        const uniqueFileName = `${uuidv4()}_${file.name}`;

        try {
            setUploading(true);

            const storageRef = ref(storage, `uploads/${uniqueFileName}`);
            await uploadBytes(storageRef, file);

            try {
                await addDoc(collection(db, "tasks"), {
                    filePath: `uploads/${uniqueFileName}`,
                    status: "pending",
                    timestamp: Timestamp.now(),
                    fileName: file.name,
                });
            } catch (firestoreError) {
                console.error(firestoreError);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-white rounded-lg shadow">
            <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Selecione um arquivo IFC
                </label>

                <input
                    type="file"
                    accept=".ifc"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="w-full p-2 border rounded"
                />
            </div>

            {uploading && (
                <div>
                    carregando arquivo... aguarde!
                </div>
            )}
        </div>
    )
}

