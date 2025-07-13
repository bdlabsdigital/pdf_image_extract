import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { ProcessingOptions } from "@/components/processing-options";
import { ProcessingStatus } from "@/components/processing-status";
import { ResultsPreview } from "@/components/results-preview";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProcessingJob } from "@shared/schema";

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [processingOptions, setProcessingOptions] = useState({
    pageRange: "",
    outputFormat: "json",
    useLlm: false,
    formatLines: false,
    forceOcr: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Health check query
  const { data: healthData } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Current job query
  const { data: currentJob, refetch: refetchJob } = useQuery({
    queryKey: ["/api/jobs", processingJobId],
    enabled: !!processingJobId,
    refetchInterval: (data) => {
      if (!data || data.status === "completed" || data.status === "failed") {
        return false;
      }
      return 2000; // Poll every 2 seconds while processing
    },
  });

  const processMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/process", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingJobId(data.jobId);
      toast({
        title: "Processing Started",
        description: "Your math paper is being processed...",
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setProcessingJobId(null);
  };

  const handleProcess = async () => {
    if (!uploadedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to process",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadedFile);
    
    Object.entries(processingOptions).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    processMutation.mutate(formData);
  };

  const handleDownload = async () => {
    if (!currentJob) return;

    try {
      const response = await fetch(`/api/jobs/${currentJob.id}/download`);
      if (!response.ok) {
        throw new Error("Failed to download results");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentJob.filename.replace('.pdf', '')}_results.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: "Your results have been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download results",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Math Paper Parser</h1>
                <p className="text-xs text-gray-500">Singapore Math Papers → JSON + Images</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${healthData?.status === "connected" ? "bg-green-500" : "bg-red-500"}`}></div>
                <span className="text-sm text-gray-600">
                  {healthData?.status === "connected" ? "API Connected" : "API Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Math Paper</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileUpload={handleFileUpload}
                  onRemoveFile={handleRemoveFile}
                  uploadedFile={uploadedFile}
                />
              </CardContent>
            </Card>

            {/* Processing Options */}
            <Card>
              <CardHeader>
                <CardTitle>Processing Options</CardTitle>
              </CardHeader>
              <CardContent>
                <ProcessingOptions
                  options={processingOptions}
                  onChange={setProcessingOptions}
                />
                <div className="mt-6 pt-4 border-t">
                  <Button
                    onClick={handleProcess}
                    disabled={!uploadedFile || processMutation.isPending}
                    className="w-full"
                  >
                    {processMutation.isPending ? "Processing..." : "Process Math Paper"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Processing Status */}
            {processingJobId && (
              <ProcessingStatus job={currentJob} />
            )}

            {/* Results Preview */}
            {currentJob?.status === "completed" && (
              <ResultsPreview job={currentJob} onDownload={handleDownload} />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Sidebar healthData={healthData} />
          </div>
        </div>
      </div>
    </div>
  );
}
