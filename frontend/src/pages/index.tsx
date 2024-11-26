import FilesList from "@/components/FilesList";
import FileUpload from "@/components/FileUpload";

export default function Home() {
    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-8 text-center">
                Webphy Uploader
            </h1>

            <FileUpload />

            <FilesList />
        </div>
    )
}
