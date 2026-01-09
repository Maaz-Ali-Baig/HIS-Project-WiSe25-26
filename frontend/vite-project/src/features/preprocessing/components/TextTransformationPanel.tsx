import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TextTransformationPanelProps {
  columns: string[];
  userId: string;
  fileId: string;
  onSuccess?: () => void;
}

export function TextTransformationPanel({
  columns,
  userId,
  fileId,
  onSuccess,
}: TextTransformationPanelProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [numThemes, setNumThemes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter out 'id' column from selectable columns
  const selectableColumns = columns.filter((col) => col !== "id");

  const handleApply = async () => {
    if (selectedColumns.length === 0) {
      toast.error("No columns selected", {
        description: "Please select at least one column containing free text.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { handleTextTransformation } = await import(
        "../../home/api/uploads"
      );

      // Parse parameters
      const k = numThemes.trim() === "" ? undefined : parseInt(numThemes, 10);

      if (k !== undefined && (isNaN(k) || k < 2)) {
        toast.error("Invalid number of themes", {
          description: "Number of themes must be at least 2.",
        });
        setIsLoading(false);
        return;
      }

      await handleTextTransformation({
        userId,
        fileId,
        selected_columns: selectedColumns,
        k,
      });

      // Reset form and clear selection BEFORE triggering refresh
      setSelectedColumns([]);
      setNumThemes("");

      toast.success("Success", {
        description: `Text transformed. Original columns replaced with theme labels.`,
      });

      // Trigger refresh to get updated data from backend
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Text transformation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to transform text", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Number of Themes */}
      <div className="space-y-2">
        <Label htmlFor="num-themes" className="text-sm font-medium">
          Number of Themes
        </Label>
        <Input
          id="num-themes"
          type="number"
          min="2"
          max="50"
          value={numThemes}
          onChange={(e) => setNumThemes(e.target.value)}
          placeholder="Auto (recommended)"
        />
        <p className="text-xs text-muted-foreground">
          Leave empty for automatic detection
        </p>
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
