import { db, storage } from "@/config/firebase.config";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';

const ModelViewer = dynamic(() => import('./ModelViewer'), {
    ssr: false
});

interface IFile {
    id: string;
    filePath: string;
    status: "pending" | "processed";
    timestamp: Timestamp;
    fileName: string;
    processedPath?: string;
}

export default function FilesList() {
    const [files, setFile] = useState<IFile[]>([]);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, "tasks"),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const filesData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as IFile[]

            setFile(filesData);
        })

        return () => unsubscribe();
    }, []);

    const handleViewModel = async (file: IFile) => {
        if (!file.processedPath) return;

        try {
            setLoading(true);
            const modelRef = ref(storage, file.processedPath);
            const url = await getDownloadURL(modelRef);
            console.log('Loading model from:', url);
            setSelectedModel(url);
        } catch (error) {
            console.error('Error getting model URL:', error);
            alert('Erro ao carregar o modelo');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <p>Carregando...</p>
    }

    return (
        <div className="mt-8">
            <h2 className="font-xl font-bold mb-4">
                Arquivos
            </h2>

            {selectedModel && (
                <div className="mb-8">
                    <ModelViewer modelUrl={selectedModel} />
                    <button
                        onClick={() => setSelectedModel(null)}
                        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
                    >
                        Fechar Visualização
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {files.map((file) => (
                    <div
                        key={file.id}
                        className="p-4 bg-white rounded-lg shadow flex justify-between items-center"
                    >
                        <div>
                            <p className="font-medium">{file.fileName}</p>

                            <p className="font-medium">
                                {file.timestamp.toDate().toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>

                            <p className="text-sm text-gray-500">
                                Status: {file.status}
                            </p>
                        </div>

                        {file.status === "processed" && (
                            <button
                                onClick={() => handleViewModel(file)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                            >
                                Visualizar
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
