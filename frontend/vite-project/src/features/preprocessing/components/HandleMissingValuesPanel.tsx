import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";

interface HandleMissingValuesPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

type MissingValueMethod =
  | "row-deletion"
  | "mode"
  | "median"
  | "missing-category"
  | "model-based";

export function HandleMissingValuesPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: HandleMissingValuesPanelProps) {
  const [selectedMethod, setSelectedMethod] =
    useState<MissingValueMethod>("row-deletion");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter out 'id' column from selectable columns
  const selectableColumns = columns.filter((col) => col !== "id");

  const methods: Array<{ value: MissingValueMethod; label: string }> = [
    { value: "row-deletion", label: "Row Deletion" },
    { value: "mode", label: "Handle using Mode" },
    { value: "median", label: "Handle using Median" },
    { value: "missing-category", label: "Create Missing Category" },
    { value: "model-based", label: "Model Based Imputation" },
  ];

  const handleApply = async () => {
    if (selectedColumns.length === 0) {
      toast.error("No columns selected", {
        description:
          "Please select at least one column to apply missing value handling.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { handleMissingValues } = await import("../../home/api/uploads");

      await handleMissingValues({
        userId,
        fileId,
        selected_columns: selectedColumns,
        selected_method: selectedMethod,
      });

      toast.success("Success", {
        description: `Missing values handled successfully using ${methods.find((m) => m.value === selectedMethod)?.label}.`,
      });

      // Trigger refresh
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to handle missing values", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Method Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Method</Label>
        <div className="space-y-0.5">
          {methods.map((method) => (
            <label
              key={method.value}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
            >
              <input
                type="radio"
                name="missing-value-method"
                value={method.value}
                checked={selectedMethod === method.value}
                onChange={() => setSelectedMethod(method.value)}
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <span className="text-sm">{method.label}</span>
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
          options={selectableColumns}
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
        disabled={selectedColumns.length === 0 || isLoading}
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Apply"}
      </Button>
    </div>
  );
}
