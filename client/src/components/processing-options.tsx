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
              <SelectItem value="json">JSON + HTML Tables</SelectItem>
              <SelectItem value="json,html">JSON + HTML Tables</SelectItem>
              <SelectItem value="json,markdown">JSON + Markdown Tables</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="useLlm"
            checked={options.useLlm}
            onCheckedChange={(checked) => handleChange("useLlm", checked)}
          />
          <Label htmlFor="useLlm" className="text-sm font-medium">
            Use LLM Enhancement
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="formatLines"
            checked={options.formatLines}
            onCheckedChange={(checked) => handleChange("formatLines", checked)}
          />
          <Label htmlFor="formatLines" className="text-sm font-medium">
            Format Math Lines
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="forceOcr"
            checked={options.forceOcr}
            onCheckedChange={(checked) => handleChange("forceOcr", checked)}
          />
          <Label htmlFor="forceOcr" className="text-sm font-medium">
            Force OCR
          </Label>
        </div>
      </div>
    </div>
  );
}
