import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getFileData } from "../../home/api/uploads";

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

  // Fetch file data to detect column types
  const { data: fileData } = useQuery({
    queryKey: ["fileData", userId, fileId],
    queryFn: () => getFileData({ userId, fileId }),
    enabled: Boolean(userId && fileId),
  });

  // Detect numeric columns (same logic as DataSummary)
  const numericColumns = useMemo(() => {
    if (!fileData) return [];
    
    return fileData.columns.filter((col) => {
      if (col === "id") return false;
      
      const values = fileData.rows.map((row) => row[col]);
      const nonEmptyValues = values.filter((v) => v !== null && v !== undefined && v !== "" && String(v).trim() !== "");
      
      if (nonEmptyValues.length === 0) return false;
      
      // Check for date/time column names first - these should NOT be treated as numeric
      const dateTimeColumnPatterns = [
        /date/i, /time/i, /timestamp/i, /datetime/i, 
        /_at$/i, /_on$/i, /created/i, /updated/i, 
        /modified/i, /deleted/i, /ts$/i, /dt$/i
      ];
      
      const isDateTimeColumnName = dateTimeColumnPatterns.some(pattern => 
        pattern.test(col)
      );
      
      if (isDateTimeColumnName) return false;
      
      // Check if numeric (≥80% numeric values)
      const numericCount = nonEmptyValues.filter((v) => {
        const strVal = String(v).replace(/,/g, "");
        const num = parseFloat(strVal);
        return !isNaN(num) && isFinite(num);
      }).length;
      
      const isNumeric = numericCount / nonEmptyValues.length >= 0.8;
      
      if (!isNumeric) return false;
      
      // Additional check: if values look like Unix timestamps, exclude them
      const sampleSize = Math.min(50, nonEmptyValues.length);
      const sample = nonEmptyValues.slice(0, sampleSize);
      const timestampCount = sample.filter((v) => {
        const strVal = String(v).trim();
        return /^\d{10}$/.test(strVal) || /^\d{13}$/.test(strVal);
      }).length;
      
      // If >70% are timestamps, exclude this column
      if (timestampCount / sampleSize >= 0.7) return false;
      
      return true;
    });
  }, [fileData]);

  // Filter columns based on selected method
  const selectableColumns = useMemo(() => {
    const baseColumns = columns.filter((col) => col !== "id");
    
    // For median method, only show numeric columns
    if (selectedMethod === "median") {
      return baseColumns.filter((col) => numericColumns.includes(col));
    }
    
    return baseColumns;
  }, [columns, selectedMethod, numericColumns]);

  // Clear selection when method changes if selected columns are no longer valid
  const handleMethodChange = (method: MissingValueMethod) => {
    setSelectedMethod(method);
    
    // If switching to median, remove non-numeric columns from selection
    if (method === "median") {
      setSelectedColumns((prev) => prev.filter((col) => numericColumns.includes(col)));
    }
  };

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
                onChange={() => handleMethodChange(method.value)}
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
          <Label className="text-sm font-medium">
            Select Columns
            {selectedMethod === "median" && (
              <span className="text-xs text-muted-foreground ml-1">(Numeric only)</span>
            )}
          </Label>
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
            {selectedMethod === "median" 
              ? "No numeric columns available. Median imputation only works with numeric data."
              : "No columns available for selection."}
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

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={selectableColumns.length === 0 || selectedColumns.length === 0 || isLoading}
        className="w-full"
        size="sm"
      >
        {isLoading ? "Applying..." : "Apply"}
      </Button>
    </div>
  );
}
