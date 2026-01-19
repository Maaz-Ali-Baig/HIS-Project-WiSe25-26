import { useState, useMemo, useEffect } from "react";
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

export function UnivariateVisualizationPanel({ fileData, userId, fileId, onPlotGenerated }: Props) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xColumn, setXColumn] = useState<string>("");
  const [topNInput, setTopNInput] = useState<string>("10");
  const [includeMissing, setIncludeMissing] = useState<boolean>(false);
  const [ordered, setOrdered] = useState<boolean>(false);
  const [uniqueCategoriesCount, setUniqueCategoriesCount] = useState<number>(0);

  const categoricalColumns = useMemo(() => {
    return filterAnalysisColumns(fileData.columns, fileData.rows);
  }, [fileData]);

  // Calculate unique categories count for selected column
  useEffect(() => {
    if (!xColumn || !fileData.rows) {
      setUniqueCategoriesCount(0);
      return;
    }

    const uniqueValues = new Set(
      fileData.rows.map((row: any) => row[xColumn])
    );
    setUniqueCategoriesCount(uniqueValues.size);
  }, [xColumn, fileData.rows]);

  const plotMutation = useMutation<PlotResponse, Error, Parameters<typeof createPlot>[0]>({
    mutationFn: createPlot,
    onSuccess: (data) => {
      onPlotGenerated(data);
    },
  });

  const handleGenerate = () => {
    if (!xColumn) return;

    const topN = parseInt(topNInput) || 10;

    const options: Record<string, any> = {
      include_missing: includeMissing,
    };

    if (chartType === "topn_bar") {
      options.top_n = topN;
      options.other_label = "Other";
    }

    if (chartType === "ordered_bar" || chartType === "cumulative_percent") {
      options.ordered = ordered;
    }

    plotMutation.mutate({
      userId,
      fileId,
      chartType,
      xColumn,
      options,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Chart Type</Label>
        <Select
          value={chartType}
          onValueChange={(value) => setChartType(value as ChartType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar Chart</SelectItem>
            <SelectItem value="topn_bar">Top N Bar</SelectItem>
            <SelectItem value="pareto">Pareto Chart</SelectItem>
            <SelectItem value="cumulative_percent">Cumulative %</SelectItem>
            <SelectItem value="ordered_bar">Ordered Bar</SelectItem>
            <SelectItem value="pie">Pie Chart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Column</Label>
          {xColumn && uniqueCategoriesCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {uniqueCategoriesCount} categories
            </span>
          )}
        </div>
        <Select value={xColumn} onValueChange={setXColumn}>
          <SelectTrigger>
            <SelectValue placeholder="Select column" />
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

      {chartType === "topn_bar" && (
        <div className="space-y-2">
          <Label>Top N Categories</Label>
          <Input
            type="text"
            value={topNInput}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string or valid numbers
              if (value === "" || /^\d+$/.test(value)) {
                setTopNInput(value);
              }
            }}
            onBlur={() => {
              // On blur, ensure we have a valid number
              const num = parseInt(topNInput);
              if (isNaN(num) || num < 1) {
                setTopNInput("1");
              }
            }}
            placeholder="Enter number (min: 1)"
          />
          {uniqueCategoriesCount > 0 && topNInput && (
            <p className="text-sm text-muted-foreground">
              Showing {Math.min(parseInt(topNInput) || 10, uniqueCategoriesCount)} of {uniqueCategoriesCount} categories
            </p>
          )}
        </div>
      )}

      {(chartType === "ordered_bar" || chartType === "cumulative_percent") && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="ordered"
            checked={ordered}
            onCheckedChange={(checked) => setOrdered(Boolean(checked))}
          />
          <Label htmlFor="ordered">Respect level order</Label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="include-missing"
          checked={includeMissing}
          onCheckedChange={(checked) => setIncludeMissing(Boolean(checked))}
        />
        <Label htmlFor="include-missing">Include missing values</Label>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!xColumn || plotMutation.isPending}
        className="w-full"
      >
        {plotMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Generating...
          </>
        ) : (
          "Generate Plot"
        )}
      </Button>

      {plotMutation.isError && plotMutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            {(() => {
              const error = plotMutation.error;
              return error instanceof Error 
                ? error.message 
                : typeof error === 'string'
                ? error
                : String(error) || "Failed to generate plot";
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
