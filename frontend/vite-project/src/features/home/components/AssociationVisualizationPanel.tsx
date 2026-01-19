import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";
import { createPlot, type ChartType, type PlotResponse } from "../api/visualization";
import type { FileDataResponse } from "../api/uploads";
import { filterAnalysisColumns } from "@/lib/columnFilters";

interface Props {
  fileData: FileDataResponse;
  userId: string;
  fileId: string;
  onPlotGenerated: (data: PlotResponse) => void;
}

export function AssociationVisualizationPanel({ fileData, userId, fileId, onPlotGenerated }: Props) {
  const [chartType, setChartType] = useState<ChartType>("assoc_target_bar");
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [topKInput, setTopKInput] = useState<string>("10");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const categoricalColumns = useMemo(() => {
    return filterAnalysisColumns(fileData.columns, fileData.rows);
  }, [fileData]);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === categoricalColumns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns([...categoricalColumns]);
    }
  };

  const plotMutation = useMutation<PlotResponse, Error, { userId: string; fileId: string; chartType: ChartType; options: Record<string, any> }, unknown>({
    mutationFn: createPlot,
    onSuccess: (data) => {
      onPlotGenerated(data);
    },
  });

  const handleGenerate = () => {
    const options: Record<string, any> = {};

    if (chartType === "assoc_target_bar") {
      if (!targetColumn) return;
      options.target_column = targetColumn;
      const topKValue = parseInt(topKInput);
      if (!isNaN(topKValue) && topKValue > 0) {
        options.top_k = topKValue;
      }
    }

    if (chartType === "assoc_heatmap") {
      if (selectedColumns.length < 2) return;
      options.selected_columns = selectedColumns;
    }

    plotMutation.mutate({
      userId,
      fileId,
      chartType,
      options,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Analysis Type</Label>
        <Select
          value={chartType}
          onValueChange={(value) => setChartType(value as ChartType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assoc_target_bar">Target Association Bar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {chartType === "assoc_target_bar" && (
        <>
          <div className="space-y-2">
            <Label>Target Column</Label>
            <Select value={targetColumn} onValueChange={setTargetColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Select target column" />
              </SelectTrigger>
              <SelectContent>
                {categoricalColumns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Top K Associations</Label>
            <Input
              type="text"
              placeholder="Enter number (e.g., 10)"
              value={topKInput}
              onChange={(e) => setTopKInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(topKInput);
                if (isNaN(val) || val < 1) {
                  setTopKInput("10");
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Show top strongest associations
            </p>
          </div>
        </>
      )}

      <Button
        onClick={handleGenerate}
        disabled={
          (chartType === "assoc_target_bar" && !targetColumn) ||
          plotMutation.isPending
        }
        className="w-full"
      >
        {plotMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Analyzing...
          </>
        ) : (
          "Generate Analysis"
        )}
      </Button>

      {plotMutation.isError && plotMutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            {plotMutation.error.message || "Failed to generate analysis"}
          </span>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 pt-2">
        <p className="font-medium">Association Methods:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Cramér's V for categorical variables</li>
          <li>Values range from 0 (no association) to 1 (perfect association)</li>
        </ul>
      </div>
    </div>
  );
}
