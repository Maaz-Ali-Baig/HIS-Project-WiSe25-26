import { apiFetch } from "@/lib/http";
import type { ColumnMetadataResponse } from "@/lib/ordinalScales";

export type ChartType =
  // Univariate categorical
  | "bar"
  | "topn_bar"
  | "pareto"
  | "cumulative_percent"
  | "ordered_bar"
  // Bivariate categorical
  | "stacked_bar_100"
  | "grouped_bar"
  | "contingency_heatmap_percent"
  | "likert_diverging"
  // Association analysis
  | "assoc_heatmap"
  | "assoc_target_bar"
  // Legacy/numeric
  | "pie"
  | "histogram"
  | "qq"
  | "qqline"
  | "scatter"
  | "stacked_bar";

export interface PlotRequest {
  userId: string;
  fileId: string;
  chartType: ChartType;
  xColumn?: string;
  yColumn?: string;
  options?: {
    bins?: number;
    top_n?: number;
    top_categories?: number;
    max_points?: number;
    include_missing?: boolean;
    other_label?: string;
    ordered?: boolean;
    levels?: string[];
    percent_mode?: "row" | "col" | "within_x" | "within_y";
    neutral_value?: string | number;
    target_column?: string;
    top_k?: number;
    max_columns?: number;
  };
}

export interface PlotResponse {
  chartType: ChartType;
  xColumn?: string | null;
  yColumn?: string | null;
  data: Record<string, any>;
}

export async function createPlot(request: PlotRequest): Promise<PlotResponse> {
  return apiFetch<PlotResponse>("/api/visualization/plot", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getColumnMetadata(
  userId: string,
  fileId: string
): Promise<ColumnMetadataResponse> {
  return apiFetch<ColumnMetadataResponse>(
    `/api/visualization/column-metadata/${userId}/${fileId}`
  );
}
