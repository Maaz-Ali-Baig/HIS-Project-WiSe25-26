import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";

interface DataEncodingPanelProps {
  columns: string[];
}

type EncodingTechnique = "one-hot" | "label" | "frequency" | "target";

export function DataEncodingPanel({ columns }: DataEncodingPanelProps) {
  const [selectedTechnique, setSelectedTechnique] =
    useState<EncodingTechnique>("one-hot");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const techniques: Array<{ value: EncodingTechnique; label: string }> = [
    { value: "one-hot", label: "One Hot" },
    { value: "label", label: "Label" },
    { value: "frequency", label: "Frequency" },
    { value: "target", label: "Target" },
  ];

  const handleApply = () => {
    // TODO: Implement API call
    console.log("Apply:", {
      technique: selectedTechnique,
      columns: selectedColumns,
    });
  };

  return (
    <div className="space-y-4">
      {/* Technique Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Technique</Label>
        <div className="space-y-0.5">
          {techniques.map((technique) => (
            <label
              key={technique.value}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
            >
              <input
                type="radio"
                name="encoding-technique"
                value={technique.value}
                checked={selectedTechnique === technique.value}
                onChange={() => setSelectedTechnique(technique.value)}
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <span className="text-sm">{technique.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Column Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Select Columns</Label>
          {selectedColumns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedColumns([])}
              className="h-7 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>

        <MultiSelect
          options={columns}
          value={selectedColumns}
          onChange={setSelectedColumns}
          placeholder="Search columns..."
        />

        {selectedColumns.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedColumns.length} column
            {selectedColumns.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={selectedColumns.length === 0}
        className="w-full"
        size="sm"
      >
        Apply
      </Button>
    </div>
  );
}
