import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import type { ProcessingJob } from "@shared/schema";

interface ResultsPreviewProps {
  job: ProcessingJob;
  onDownload: () => void;
}

export function ResultsPreview({ job, onDownload }: ResultsPreviewProps) {
  const jsonPreview = job.jsonResult ? JSON.stringify(job.jsonResult, null, 2) : "{}";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Processing Results</CardTitle>
          <Button onClick={onDownload} className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Download ZIP</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{job.questionsFound}</div>
              <div className="text-sm text-gray-500">Questions Found</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{job.imagesExtracted}</div>
              <div className="text-sm text-gray-500">Images Extracted</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{job.tablesConverted}</div>
              <div className="text-sm text-gray-500">Tables Converted</div>
            </div>
          </div>

          {/* Preview Tabs */}
          <Tabs defaultValue="json" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="json">JSON Preview</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="tables">Tables</TabsTrigger>
            </TabsList>
            
            <TabsContent value="json" className="mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 overflow-x-auto max-h-96">
                  <code>{jsonPreview}</code>
                </pre>
              </div>
            </TabsContent>
            
            <TabsContent value="images" className="mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  {job.imagesExtracted > 0 
                    ? `${job.imagesExtracted} images extracted and converted to WebP format. Download the ZIP file to view them.`
                    : "No images were extracted from this document."
                  }
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="tables" className="mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  {job.tablesConverted > 0 
                    ? `${job.tablesConverted} tables converted to HTML format. Download the ZIP file to view them.`
                    : "No tables were found in this document."
                  }
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
