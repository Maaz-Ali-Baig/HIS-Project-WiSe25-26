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

export function BivariateVisualizationPanel({ fileData, userId, fileId, onPlotGenerated }: Props) {
  const [chartType, setChartType] = useState<ChartType>("stacked_bar_100");
  const [xColumn, setXColumn] = useState<string>("");
  const [yColumn, setYColumn] = useState<string>("");
  const [includeMissing, setIncludeMissing] = useState<boolean>(false);
  const [percentMode, setPercentMode] = useState<"row" | "col">("row");

  const categoricalColumns = useMemo(() => {
    return filterAnalysisColumns(fileData.columns, fileData.rows);
  }, [fileData]);

  const plotMutation = useMutation<
    PlotResponse,
    Error,
    {
      userId: string;
      fileId: string;
      chartType: ChartType;
      xColumn: string;
      yColumn?: string;
      options?: Record<string, any>;
    }
  >({
    mutationFn: (params) => createPlot(params),
    onSuccess: (data: PlotResponse) => {
      onPlotGenerated(data);
    },
  });

  const handleGenerate = () => {
    if (!xColumn || !yColumn) return;

    const options: Record<string, any> = {
      include_missing: includeMissing,
    };

    if (chartType === "contingency_heatmap_percent") {
      options.percent_mode = percentMode;
    }

    plotMutation.mutate({
      userId,
      fileId,
      chartType,
      xColumn,
      yColumn,
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
            <SelectItem value="stacked_bar_100">Stacked Bar (100%)</SelectItem>
            <SelectItem value="grouped_bar">Grouped Bar</SelectItem>
            <SelectItem value="contingency_heatmap_percent">Contingency Heatmap</SelectItem>
            <SelectItem value="likert_diverging">Likert Diverging</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>X Column</Label>
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

      <div className="space-y-2">
        <Label>Y Column</Label>
        <Select value={yColumn} onValueChange={setYColumn}>
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

      {chartType === "contingency_heatmap_percent" && (
        <div className="space-y-2">
          <Label>Percentage Mode</Label>
          <Select
            value={percentMode}
            onValueChange={(value) => setPercentMode(value as "row" | "col")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="row">Row % (within X)</SelectItem>
              <SelectItem value="col">Column % (within Y)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="include-missing-biv"
          checked={includeMissing}
          onCheckedChange={(checked) => setIncludeMissing(Boolean(checked))}
        />
        <Label htmlFor="include-missing-biv">Include missing values</Label>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!xColumn || !yColumn || plotMutation.isPending}
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
