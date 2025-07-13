import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  onRemoveFile: () => void;
  uploadedFile: File | null;
}

export function FileUpload({ onFileUpload, onRemoveFile, uploadedFile }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file.type === "application/pdf") {
      onFileUpload(file);
    } else {
      alert("Please select a PDF file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          <Upload className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-900 mb-2">Drop your PDF file here</p>
        <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
        <Button variant="outline">
          Select File
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {uploadedFile && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              className="text-gray-400 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
