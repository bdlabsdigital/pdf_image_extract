import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle, Circle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProcessingJob } from "@shared/schema";

interface SidebarProps {
  healthData: any;
}

export function Sidebar({ healthData }: SidebarProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const apiKey = "Adobe PDF Services configured";
  const displayKey = showApiKey ? apiKey : "Adobe PDF Services";

  const { data: recentJobs } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 30000,
  });

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey">Adobe PDF Services</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="apiKey"
                  type="text"
                  value={displayKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">Ready</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Service Status</span>
                <span className={`font-medium ${healthData?.adobe?.status === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {healthData?.adobe?.status === "ok" ? "Ready" : "Not Ready"}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {healthData?.adobe?.message || "Adobe PDF Services"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentJobs && recentJobs.length > 0 ? (
              recentJobs.slice(0, 5).map((job: ProcessingJob) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      job.status === "completed" ? "bg-green-500" : 
                      job.status === "processing" ? "bg-blue-500" : 
                      job.status === "failed" ? "bg-red-500" : "bg-gray-400"
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.filename}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(job.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent processing jobs</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help & Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Best Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <CheckCircle className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-sm text-gray-700">Use high-quality PDF scans for better OCR accuracy</p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <CheckCircle className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-sm text-gray-700">Enable LLM enhancement for complex mathematical expressions</p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <CheckCircle className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-sm text-gray-700">Specify page ranges to process only relevant sections</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
