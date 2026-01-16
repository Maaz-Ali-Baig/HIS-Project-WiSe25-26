import { apiFetch } from "@/lib/http";

export type ChartType =
  | "pie"
  | "bar"
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
    top_categories?: number;
    max_points?: number;
    include_missing?: boolean;
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
