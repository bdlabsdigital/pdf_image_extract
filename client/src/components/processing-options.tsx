import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface ProcessingOptionsProps {
  options: {
    pageRange: string;
    outputFormat: string;
    useLlm: boolean;
    formatLines: boolean;
    forceOcr: boolean;
  };
  onChange: (options: any) => void;
}

export function ProcessingOptions({ options, onChange }: ProcessingOptionsProps) {
  const handleChange = (key: string, value: any) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div>
          <Label htmlFor="pageRange">Page Range</Label>
          <Input
            id="pageRange"
            value={options.pageRange}
            onChange={(e) => handleChange("pageRange", e.target.value)}
            placeholder="e.g., 1-5,10,15-20"
          />
        </div>

        <div>
          <Label htmlFor="outputFormat">Output Format</Label>
          <Select
            value={options.outputFormat}
            onValueChange={(value) => handleChange("outputFormat", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON Questions + WebP Images</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-md">
          <strong>Adobe PDF Services</strong> automatically extracts text, images, and tables from PDF documents. Processing options are optimized for PDF documents with images and text.
        </div>
      </div>
    </div>
  );
}
