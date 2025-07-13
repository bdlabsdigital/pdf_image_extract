import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Loader2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProcessingJob } from "@shared/schema";

interface ProcessingStatusProps {
  job: ProcessingJob | undefined;
}

export function ProcessingStatus({ job }: ProcessingStatusProps) {
  const queryClient = useQueryClient();
  
  const checkResultsMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return apiRequest('POST', `/api/jobs/${jobId}/check`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', job?.id] });
    }
  });

  if (!job) return null;

  const getStepStatus = (stepIndex: number) => {
    if (job.status === "failed") return "failed";
    if (job.status === "completed") return "completed";
    if (job.status === "processing") {
      // Simple heuristic for step progress
      return stepIndex <= 1 ? "completed" : stepIndex === 2 ? "processing" : "pending";
    }
    return stepIndex === 0 ? "completed" : "pending";
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed":
        return <Circle className="w-4 h-4 text-red-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getProgressValue = (status: string) => {
    switch (status) {
      case "completed":
        return 100;
      case "processing":
        return 60;
      case "failed":
        return 0;
      default:
        return 0;
    }
  };

  const steps = [
    { name: "Uploading PDF", status: getStepStatus(0) },
    { name: "Analyzing Layout", status: getStepStatus(1) },
    { name: "Extracting Questions", status: getStepStatus(2) },
    { name: "Converting Images", status: getStepStatus(3) },
  ];

  const getCurrentStepMessage = () => {
    if (job.status === "completed") {
      return "Processing complete! Review your results below.";
    }
    if (job.status === "failed") {
      return job.error || "Processing failed. Please try again.";
    }
    if (job.status === "processing") {
      return "Analyzing document layout and identifying math questions...";
    }
    return "Preparing to process your document...";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">{step.name}</span>
                  {getStepIcon(step.status)}
                </div>
                <Progress value={getProgressValue(step.status)} className="h-2" />
              </div>
            </div>
          ))}

          <div className={`p-4 rounded-lg ${job.status === "failed" ? "bg-red-50" : "bg-blue-50"}`}>
            <p className={`text-sm ${job.status === "failed" ? "text-red-700" : "text-blue-700"}`}>
              <strong>Current:</strong> {getCurrentStepMessage()}
            </p>
            
            {job.status === "processing" && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  Need to check for results? Click the button to manually check status.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => checkResultsMutation.mutate(job.id)}
                  disabled={checkResultsMutation.isPending}
                >
                  {checkResultsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Check Results
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
