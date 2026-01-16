import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { getFileData } from "../api/uploads";
import { createPlot } from "../api/visualization";
import type { ChartType, PlotResponse } from "../api/visualization";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { AlertCircle, Loader2 } from "lucide-react";

type ColumnType = "numeric" | "categorical";

const chartConfig: Record<
  ChartType,
  { label: string; xType: ColumnType; yType?: ColumnType }
> = {
  pie: { label: "Pie (categorical)", xType: "categorical" },
  bar: { label: "Bar (categorical)", xType: "categorical" },
  histogram: { label: "Histogram (numeric)", xType: "numeric" },
  qq: { label: "QQ Plot (numeric)", xType: "numeric" },
  qqline: { label: "QQ Plot + Line (numeric)", xType: "numeric" },
  scatter: {
    label: "Scatter (numeric vs numeric)",
    xType: "numeric",
    yType: "numeric",
  },
  stacked_bar: {
    label: "Stacked Bar (categorical vs categorical)",
    xType: "categorical",
    yType: "categorical",
  },
};

const palette = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#0ea5e9",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
];

export function VisualizationPage() {
  const { fileId } = useParams<{ fileId?: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xColumn, setXColumn] = useState<string>("");
  const [yColumn, setYColumn] = useState<string>("");
  const [bins, setBins] = useState<number>(10);
  const [topCategories, setTopCategories] = useState<number>(8);
  const [maxPoints, setMaxPoints] = useState<number>(1000);
  const [includeMissing, setIncludeMissing] = useState<boolean>(false);
  const [plotData, setPlotData] = useState<PlotResponse | null>(null);

  useEffect(() => {
    if (!fileId || !user) {
      navigate("/");
    }
  }, [fileId, user, navigate]);

  const { data: fileData } = useQuery({
    queryKey: ["fileData", user?.id, fileId],
    queryFn: () =>
      getFileData({
        userId: user!.id,
        fileId: fileId!,
      }),
    enabled: Boolean(user?.id && fileId),
  });

  const numericColumns = useMemo(() => {
    if (!fileData) return [];

    return fileData.columns.filter((col) => {
      if (col === "id") return false;
      const values = fileData.rows
        .map((row) => row[col])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

      if (values.length === 0) return false;

      const sample = values.slice(0, 100);
      const numericCount = sample.filter((v) => {
        const strVal = String(v).replace(/,/g, "");
        const num = parseFloat(strVal);
        return !isNaN(num) && isFinite(num);
      }).length;

      return numericCount / sample.length >= 0.8;
    });
  }, [fileData]);

  const categoricalColumns = useMemo(() => {
    if (!fileData) return [];
    return fileData.columns.filter(
      (col) => col !== "id" && !numericColumns.includes(col),
    );
  }, [fileData, numericColumns]);

  const availableXColumns = useMemo(() => {
    const config = chartConfig[chartType];
    return config.xType === "numeric" ? numericColumns : categoricalColumns;
  }, [chartType, numericColumns, categoricalColumns]);

  const availableYColumns = useMemo(() => {
    const config = chartConfig[chartType];
    if (!config.yType) return [];
    return config.yType === "numeric" ? numericColumns : categoricalColumns;
  }, [chartType, numericColumns, categoricalColumns]);

  useEffect(() => {
    if (availableXColumns.length > 0 && !availableXColumns.includes(xColumn)) {
      setXColumn(availableXColumns[0]);
    }
    if (availableXColumns.length === 0) {
      setXColumn("");
    }
  }, [availableXColumns, xColumn]);

  useEffect(() => {
    if (!chartConfig[chartType].yType) {
      setYColumn("");
      return;
    }
    if (availableYColumns.length > 0 && !availableYColumns.includes(yColumn)) {
      setYColumn(availableYColumns[0]);
    }
    if (availableYColumns.length === 0) {
      setYColumn("");
    }
  }, [chartType, availableYColumns, yColumn]);

  const plotMutation = useMutation({
    mutationFn: createPlot,
    onSuccess: (data) => {
      setPlotData(data);
    },
  });

  const handleGenerate = () => {
    if (!user?.id || !fileId) return;
    if (!xColumn || (chartConfig[chartType].yType && !yColumn)) return;

    const options: Record<string, any> = {};
    if (chartType === "histogram") {
      options.bins = bins;
    }
    if (chartType === "pie" || chartType === "bar") {
      options.top_categories = topCategories;
      options.include_missing = includeMissing;
    }
    if (chartType === "stacked_bar") {
      options.include_missing = includeMissing;
    }
    if (chartType === "scatter" || chartType === "qq" || chartType === "qqline") {
      options.max_points = maxPoints;
    }

    plotMutation.mutate({
      userId: user.id,
      fileId,
      chartType,
      xColumn,
      yColumn: yColumn || undefined,
      options,
    });
  };

  const renderStats = (stats?: Record<string, any>) => {
    if (!stats) return null;
    const entries = Object.entries(stats);
    if (entries.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="capitalize">{key.replace(/_/g, " ")}</span>
            <span className="font-medium text-foreground">
              {typeof value === "number" ? value.toFixed(3) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    if (!plotData) return null;
    const data = plotData.data;

    if (plotData.chartType === "pie") {
      const pieData = data.categories.map((name: string, idx: number) => ({
        name,
        value: data.counts[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" label>
              {pieData.map((entry: any, idx: number) => (
                <Cell key={entry.name} fill={palette[idx % palette.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (plotData.chartType === "bar") {
      const barData = data.categories.map((name: string, idx: number) => ({
        name,
        value: data.counts[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill={palette[0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (plotData.chartType === "histogram") {
      const histogramData = data.bins.map(
        (bin: { start: number; end: number; count: number }) => ({
          range: `${bin.start.toFixed(2)} - ${bin.end.toFixed(2)}`,
          count: bin.count,
        }),
      );

      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill={palette[2]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (plotData.chartType === "qq" || plotData.chartType === "qqline") {
      const points = data.points || [];
      const line = data.line || null;

      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="theoretical"
              type="number"
              name="Theoretical Quantile"
            />
            <YAxis dataKey="sample" type="number" name="Sample Quantile" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} fill={palette[3]} />
            {line && line.length === 2 && (
              <ReferenceLine
                segment={[
                  { x: line[0].theoretical, y: line[0].sample },
                  { x: line[1].theoretical, y: line[1].sample },
                ]}
                stroke={palette[4]}
                strokeWidth={2}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (plotData.chartType === "scatter") {
      const points = data.points || [];
      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" name={xColumn} />
            <YAxis dataKey="y" type="number" name={yColumn} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} fill={palette[1]} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (plotData.chartType === "stacked_bar") {
      const xCategories = data.x_categories || [];
      const series = data.series || [];
      const stackedData = xCategories.map((category: string, idx: number) => {
        const row: Record<string, any> = { category };
        series.forEach((s: any) => {
          row[s.name] = s.values[idx] ?? 0;
        });
        return row;
      });

      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={stackedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s: any, idx: number) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                stackId="a"
                fill={palette[idx % palette.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="bg-background w-full min-h-screen p-6">
      <div className="mx-auto w-full space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Visualization</CardTitle>
            <CardDescription className="text-sm">
              Generate live plots from the selected dataset using R-backed
              statistics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Chart Type</Label>
                <Select
                  value={chartType}
                  onValueChange={(value) => setChartType(value as ChartType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(chartConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
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
                    {availableXColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {chartConfig[chartType].yType && (
                <div className="space-y-2">
                  <Label>Y Column</Label>
                  <Select value={yColumn} onValueChange={setYColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(chartType === "histogram") && (
                <div className="space-y-2">
                  <Label>Bins</Label>
                  <Input
                    type="number"
                    min={3}
                    max={50}
                    value={bins}
                    onChange={(e) => setBins(Number(e.target.value))}
                  />
                </div>
              )}

              {(chartType === "pie" || chartType === "bar") && (
                <div className="space-y-2">
                  <Label>Top Categories</Label>
                  <Input
                    type="number"
                    min={3}
                    max={50}
                    value={topCategories}
                    onChange={(e) => setTopCategories(Number(e.target.value))}
                  />
                </div>
              )}

              {(chartType === "scatter" ||
                chartType === "qq" ||
                chartType === "qqline") && (
                <div className="space-y-2">
                  <Label>Max Points</Label>
                  <Input
                    type="number"
                    min={100}
                    max={5000}
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(Number(e.target.value))}
                  />
                </div>
              )}

              {(chartType === "pie" ||
                chartType === "bar" ||
                chartType === "stacked_bar") && (
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="include-missing"
                    checked={includeMissing}
                    onCheckedChange={(checked) =>
                      setIncludeMissing(Boolean(checked))
                    }
                  />
                  <Label htmlFor="include-missing">Include missing</Label>
                </div>
              )}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={
                !xColumn ||
                (chartConfig[chartType].yType && !yColumn) ||
                plotMutation.isPending
              }
              className="w-full md:w-auto"
            >
              {plotMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Plot"
              )}
            </Button>

            {plotMutation.isError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>
                  {(plotMutation.error as Error).message ||
                    "Failed to generate plot"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription className="text-sm">
              Live chart generated by R statistics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plotData ? (
              <div className="space-y-4">
                {renderChart()}
                {renderStats(plotData.data?.stats)}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a chart type and columns, then generate a plot.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
