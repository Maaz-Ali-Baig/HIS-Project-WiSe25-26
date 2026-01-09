import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";

interface DataEncodingPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

type EncodingTechnique = "one-hot" | "label" | "frequency" | "target";

export function DataEncodingPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: DataEncodingPanelProps) {
  const [selectedTechnique, setSelectedTechnique] =
    useState<EncodingTechnique>("one-hot");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [targetColumns, setTargetColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter out 'id' column from selectable columns
  const selectableColumns = (columns || []).filter((col) => col !== "id");

  // Debug: Log columns on mount and when they change
  console.log("DataEncodingPanel - columns:", columns);
  console.log("DataEncodingPanel - selectableColumns:", selectableColumns);

  const techniques: Array<{
    value: EncodingTechnique;
    label: string;
    description: string;
  }> = [
    {
      value: "one-hot",
      label: "One Hot",
      description: "Create binary columns for each category",
    },
    {
      value: "label",
      label: "Label",
      description: "Assign integer labels to categories",
    },
    {
      value: "frequency",
      label: "Frequency",
      description: "Encode based on category frequency",
    },
    {
      value: "target",
      label: "Target",
      description: "Encode based on target variable mean",
    },
  ];

  const handleApply = async () => {
    if (selectedColumns.length === 0) {
      toast.error("No columns selected", {
        description: "Please select at least one column to apply encoding.",
      });
      return;
    }

    // Validate target encoding requirements
    if (selectedTechnique === "target" && targetColumns.length === 0) {
      toast.error("Target column required", {
        description: "Please select at least one target column for target encoding.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { handleEncoding } = await import("../../home/api/uploads");

      await handleEncoding({
        userId,
        fileId,
        selected_columns: selectedColumns,
        method: selectedTechnique,
        target_columns: selectedTechnique === "target" ? targetColumns : undefined,
      });

      toast.success("Success", {
        description: `Encoding applied successfully using ${techniques.find((t) => t.value === selectedTechnique)?.label}.`,
      });

      // Trigger refresh
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to apply encoding", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Technique Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Encoding Technique</Label>
        <div className="space-y-0.5">
          {techniques.map((technique) => (
            <label
              key={technique.value}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
              title={technique.description}
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

        {selectableColumns.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
            No columns available for encoding. Please ensure your file has been loaded correctly.
          </div>
        ) : (
          <MultiSelect
            options={selectableColumns}
            value={selectedColumns}
            onChange={setSelectedColumns}
            placeholder="Search columns..."
          />
        )}

        {selectedColumns.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedColumns.length} column
            {selectedColumns.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Target Column Selection (only for target encoding) */}
      {selectedTechnique === "target" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Target Column <span className="text-destructive">*</span>
            </Label>
            {targetColumns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTargetColumns([])}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            Select the numeric target column(s) to calculate mean values for encoding
          </p>

          {selectableColumns.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
              No columns available.
            </div>
          ) : (
            <MultiSelect
              options={selectableColumns}
              value={targetColumns}
              onChange={setTargetColumns}
              placeholder="Select target column(s)..."
            />
          )}

          {targetColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {targetColumns.length} target column
              {targetColumns.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      )}

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={
          selectableColumns.length === 0 || 
          selectedColumns.length === 0 || 
          (selectedTechnique === "target" && targetColumns.length === 0) ||
          isLoading
        }
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Apply Encoding"}
      </Button>
    </div>
  );
}
