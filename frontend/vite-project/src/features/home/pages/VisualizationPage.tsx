import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { useAuthStore } from "../../../store/auth";
import { useFileStore } from "../../../store/fileStore";
import { getFileData } from "../../home/api/uploads";
import { Button } from "../../../components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Loader2, AlertCircle } from "lucide-react";
import { FileLayout } from "../../../components/layout/FileLayout";
import { ActionSidebarItem } from "../../../components/layout/ActionSidebarItem";
import { DataTable } from "../../../components/DataTable";

const chartOptions = {
  univariate: {
    categorical: ["Bar", "Pie"],
    numeric: ["Histogram", "Line"],
    datetime: ["Line"],
    text: ["Bar"],
    other: ["Bar"],
  },
  bivariate: {
    "categorical-categorical": ["Stacked Bar"],
    "numeric-numeric": ["Scatter"],
    "categorical-numeric": ["Bar (Mean)"],
    "numeric-categorical": ["Bar (Mean)"],
    "datetime-numeric": ["Line"],
  },
};

type ColumnType = "categorical" | "numeric" | "datetime" | "text" | "other";

type VizMode = "univariate" | "bivariate";

type ColumnStats = {
  count: number;
  missing: number;
  unique: number;
  mean?: number;
  median?: number;
  mode?: string;
};

const COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#f97316", "#84cc16"];

const formatNumber = (value: number) => {
  if (!isFinite(value)) return "-";
  return Number(value.toFixed(4)).toString();
};

export function VisualizationPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fileId, userId } = useFileStore();
  const { fileId: routeFileId } = useParams<{ fileId?: string }>();
  const activeFileId = routeFileId ?? fileId;

  const [mode, setMode] = useState<VizMode>("univariate");
  const [xColumn, setXColumn] = useState<string>("");
  const [yColumn, setYColumn] = useState<string>("");
  const [chartType, setChartType] = useState<string>("");
  const [chartReady, setChartReady] = useState(false);

  const {
    data: fileData,
    isLoading: isLoadingData,
    error: dataError,
    refetch: refetchData,
  } = useQuery({
    queryKey: ["fileData", userId, activeFileId],
    queryFn: () => getFileData({ userId: userId!, fileId: activeFileId! }),
    enabled: Boolean(userId && activeFileId),
    retry: 1,
  });

  const isDateTimeValue = (value: string) => {
    const patterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{2}-\d{2}-\d{4}/,
      /^\d{4}\/\d{2}\/\d{2}/,
      /^\d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    ];
    return patterns.some((pattern) => pattern.test(value));
  };

  const getColumnType = (col: string): ColumnType => {
    if (!fileData) return "other";
    const values = fileData.rows
      .map((row) => row[col])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

    if (values.length === 0) return "other";

    const sample = values.slice(0, 50).map((v) => String(v));
    const dateMatches = sample.filter((v) => isDateTimeValue(v)).length;
    if (dateMatches / sample.length >= 0.7) return "datetime";

    const numericCount = sample.filter((v) => {
      const num = parseFloat(v.replace(/,/g, ""));
      return !isNaN(num) && isFinite(num);
    }).length;

    if (numericCount / sample.length >= 0.8) return "numeric";

    const longText = sample.some((v) => v.length > 50);
    if (longText) return "text";

    return "categorical";
  };

  const columnTypes = useMemo(() => {
    if (!fileData) return {} as Record<string, ColumnType>;
    const map: Record<string, ColumnType> = {};
    fileData.columns.forEach((col) => {
      if (col === "id") return;
      map[col] = getColumnType(col);
    });
    return map;
  }, [fileData]);

  const availableColumns = useMemo(() => {
    if (!fileData) return [] as string[];
    return fileData.columns.filter((col) => col !== "id");
  }, [fileData]);

  const availableChartOptions = useMemo(() => {
    if (mode === "univariate") {
      const type = columnTypes[xColumn] || "other";
      return chartOptions.univariate[type] || [];
    }

    const xType = columnTypes[xColumn] || "other";
    const yType = columnTypes[yColumn] || "other";
    const key = `${xType}-${yType}`;
    return chartOptions.bivariate[key] || [];
  }, [mode, columnTypes, xColumn, yColumn]);

  useEffect(() => {
    if (!availableChartOptions.length) {
      setChartType("");
      return;
    }
    setChartType((prev) => (prev ? prev : availableChartOptions[0]));
  }, [availableChartOptions]);

  useEffect(() => {
    setChartReady(false);
  }, [mode, xColumn, yColumn, chartType]);

  const canGenerate = mode === "univariate"
    ? Boolean(xColumn && chartType)
    : Boolean(xColumn && yColumn && chartType);

  const getNumericValues = (col: string) => {
    if (!fileData) return [] as number[];
    return fileData.rows
      .map((row) => row[col])
      .map((v) => parseFloat(String(v).replace(/,/g, "")))
      .filter((v) => !isNaN(v) && isFinite(v));
  };

  const getCategoricalCounts = (col: string) => {
    if (!fileData) return [] as { name: string; value: number }[];
    const counts = new Map<string, number>();
    fileData.rows.forEach((row) => {
      const value = String(row[col] ?? "").trim() || "Missing";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  };

  const buildHistogram = (values: number[], bins = 10) => {
    if (!values.length) return [] as { bin: string; count: number }[];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [{ bin: `${min.toFixed(2)}`, count: values.length }];
    }
    const step = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    values.forEach((value) => {
      const idx = Math.min(bins - 1, Math.floor((value - min) / step));
      counts[idx] += 1;
    });
    return counts.map((count, i) => {
      const start = min + i * step;
      const end = start + step;
      return {
        bin: `${start.toFixed(2)}-${end.toFixed(2)}`,
        count,
      };
    });
  };

  const buildStackedBar = (xCol: string, yCol: string) => {
    if (!fileData) return { data: [], series: [] as string[] };
    const xValues = new Map<string, Map<string, number>>();
    const ySet = new Set<string>();

    fileData.rows.forEach((row) => {
      const xVal = String(row[xCol] ?? "").trim() || "Missing";
      const yVal = String(row[yCol] ?? "").trim() || "Missing";
      ySet.add(yVal);
      if (!xValues.has(xVal)) {
        xValues.set(xVal, new Map());
      }
      const yMap = xValues.get(xVal)!;
      yMap.set(yVal, (yMap.get(yVal) ?? 0) + 1);
    });

    const series = Array.from(ySet.values()).slice(0, 6);
    const data = Array.from(xValues.entries())
      .map(([xVal, yMap]) => {
        const entry: Record<string, any> = { category: xVal };
        series.forEach((s) => {
          entry[s] = yMap.get(s) ?? 0;
        });
        return entry;
      })
      .slice(0, 12);

    return { data, series };
  };

  const buildBarMean = (catCol: string, numCol: string) => {
    if (!fileData) return [] as { category: string; value: number }[];
    const sums = new Map<string, { sum: number; count: number }>();
    fileData.rows.forEach((row) => {
      const cat = String(row[catCol] ?? "").trim() || "Missing";
      const val = parseFloat(String(row[numCol] ?? "").replace(/,/g, ""));
      if (!isNaN(val)) {
        if (!sums.has(cat)) {
          sums.set(cat, { sum: 0, count: 0 });
        }
        const entry = sums.get(cat)!;
        entry.sum += val;
        entry.count += 1;
      }
    });
    return Array.from(sums.entries())
      .map(([category, stats]) => ({
        category,
        value: stats.count ? stats.sum / stats.count : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  };

  const buildScatter = (xCol: string, yCol: string) => {
    if (!fileData) return [] as { x: number; y: number }[];
    return fileData.rows
      .map((row) => ({
        x: parseFloat(String(row[xCol]).replace(/,/g, "")),
        y: parseFloat(String(row[yCol]).replace(/,/g, "")),
      }))
      .filter((point) => !isNaN(point.x) && !isNaN(point.y))
      .slice(0, 1200);
  };

  const buildLineSeries = (xCol: string, yCol: string) => {
    if (!fileData) return [] as { x: string; y: number }[];
    const data = fileData.rows
      .map((row) => ({
        x: String(row[xCol] ?? ""),
        y: parseFloat(String(row[yCol] ?? "").replace(/,/g, "")),
      }))
      .filter((point) => point.x && !isNaN(point.y));
    return data;
  };

  const buildDateCounts = (col: string) => {
    if (!fileData) return [] as { x: string; y: number }[];
    const counts = new Map<string, number>();
    fileData.rows.forEach((row) => {
      const raw = String(row[col] ?? "").trim();
      if (!raw) return;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => a.x.localeCompare(b.x));
  };

  const getColumnStats = (col: string): ColumnStats | null => {
    if (!fileData) return null;
    const rawValues = fileData.rows.map((row) => row[col]);
    const total = rawValues.length;
    const cleaned = rawValues.map((v) => (v === null || v === undefined ? "" : String(v)));
    const missing = cleaned.filter((v) => v.trim() === "").length;
    const values = cleaned.filter((v) => v.trim() !== "");

    const unique = new Set(values.map((v) => v.trim())).size;
    const type = columnTypes[col] || "other";

    if (type === "numeric") {
      const nums = values
        .map((v) => parseFloat(v.replace(/,/g, "")))
        .filter((v) => !isNaN(v) && isFinite(v));
      if (!nums.length) {
        return { count: total, missing, unique };
      }
      const sorted = [...nums].sort((a, b) => a - b);
      const mean = nums.reduce((acc, val) => acc + val, 0) / nums.length;
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return { count: total, missing, unique, mean, median };
    }

    const counts = new Map<string, number>();
    values.forEach((v) => {
      const key = v.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let mode = "";
    let modeCount = -1;
    counts.forEach((count, key) => {
      if (count > modeCount) {
        modeCount = count;
        mode = key;
      }
    });
    return { count: total, missing, unique, mode };
  };

  const chartOption = useMemo(() => {
    if (!chartReady || !fileData || !chartType) return null;

    if (mode === "univariate") {
      const type = columnTypes[xColumn] || "other";
      if (chartType === "Bar") {
        const data = getCategoricalCounts(xColumn);
        return {
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: data.map((d) => d.name) },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: data.map((d) => d.value),
              itemStyle: { color: COLORS[0] },
              barMaxWidth: 42,
            },
          ],
        };
      }
      if (chartType === "Pie") {
        const data = getCategoricalCounts(xColumn);
        return {
          tooltip: { trigger: "item" },
          legend: { bottom: 0 },
          series: [
            {
              type: "pie",
              radius: ["35%", "65%"],
              data: data.map((d, idx) => ({ name: d.name, value: d.value, itemStyle: { color: COLORS[idx % COLORS.length] } })),
            },
          ],
        };
      }
      if (chartType === "Histogram") {
        const values = getNumericValues(xColumn);
        const data = buildHistogram(values);
        return {
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: data.map((d) => d.bin) },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: data.map((d) => d.count),
              itemStyle: { color: COLORS[1] },
              barMaxWidth: 48,
            },
          ],
        };
      }
      if (chartType === "Line") {
        if (type === "datetime") {
          const data = buildDateCounts(xColumn);
          return {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: data.map((d) => d.x) },
            yAxis: { type: "value" },
            series: [
              {
                type: "line",
                data: data.map((d) => d.y),
                smooth: true,
                lineStyle: { color: COLORS[0] },
              },
            ],
          };
        }
        const values = getNumericValues(xColumn);
        const data = values.map((value, idx) => ({ index: idx + 1, value }));
        return {
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: data.map((d) => String(d.index)) },
          yAxis: { type: "value" },
          series: [
            {
              type: "line",
              data: data.map((d) => d.value),
              smooth: true,
              lineStyle: { color: COLORS[0] },
            },
          ],
        };
      }
    }

    if (mode === "bivariate") {
      if (chartType === "Stacked Bar") {
        const result = buildStackedBar(xColumn, yColumn);
        return {
          tooltip: { trigger: "axis" },
          legend: { top: 0 },
          xAxis: { type: "category", data: result.data.map((d) => String(d.category)) },
          yAxis: { type: "value" },
          series: result.series.map((key, idx) => ({
            type: "bar",
            stack: "total",
            name: key,
            data: result.data.map((d) => d[key] || 0),
            itemStyle: { color: COLORS[idx % COLORS.length] },
            barMaxWidth: 40,
          })),
        };
      }
      if (chartType === "Scatter") {
        const data = buildScatter(xColumn, yColumn);
        return {
          tooltip: { trigger: "item" },
          xAxis: { type: "value", name: xColumn },
          yAxis: { type: "value", name: yColumn },
          series: [
            {
              type: "scatter",
              data: data.map((d) => [d.x, d.y]),
              symbolSize: 6,
              itemStyle: { color: COLORS[0] },
            },
          ],
        };
      }
      if (chartType === "Line") {
        const data = buildLineSeries(xColumn, yColumn);
        return {
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: data.map((d) => d.x) },
          yAxis: { type: "value" },
          series: [
            {
              type: "line",
              data: data.map((d) => d.y),
              smooth: true,
              lineStyle: { color: COLORS[0] },
            },
          ],
        };
      }
      if (chartType === "Bar (Mean)") {
        const xType = columnTypes[xColumn] || "other";
        const catCol = xType === "categorical" ? xColumn : yColumn;
        const numCol = xType === "categorical" ? yColumn : xColumn;
        const data = buildBarMean(catCol, numCol);
        return {
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: data.map((d) => d.category) },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: data.map((d) => d.value),
              itemStyle: { color: COLORS[2] },
              barMaxWidth: 42,
            },
          ],
        };
      }
    }

    return null;
  }, [chartReady, fileData, chartType, mode, xColumn, yColumn, columnTypes]);

  const stats = useMemo(() => {
    if (!fileData || !chartReady || !canGenerate) return [] as Array<{ label: string; stats: ColumnStats }>;
    const list: Array<{ label: string; stats: ColumnStats }> = [];
    if (xColumn) {
      const stat = getColumnStats(xColumn);
      if (stat) list.push({ label: xColumn, stats: stat });
    }
    if (mode === "bivariate" && yColumn) {
      const stat = getColumnStats(yColumn);
      if (stat) list.push({ label: yColumn, stats: stat });
    }
    return list;
  }, [fileData, chartReady, canGenerate, xColumn, yColumn, mode, columnTypes]);

  if (!user) return null;

  const actions = [];

  actions.push(
    <ActionSidebarItem
      title="Visualization"
      key="visualization-controls"
      tooltipText="Select chart type and variables"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Mode</Label>
          <Tabs value={mode} onValueChange={(value) => setMode(value as VizMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="univariate">Univariate</TabsTrigger>
              <TabsTrigger value="bivariate">Bivariate</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">X Column</Label>
          <Select value={xColumn} onValueChange={setXColumn}>
            <SelectTrigger>
              <SelectValue placeholder="Select column..." />
            </SelectTrigger>
            <SelectContent>
              {availableColumns.map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "bivariate" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Y Column</Label>
            <Select value={yColumn} onValueChange={setYColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {availableColumns
                  .filter((col) => col !== xColumn)
                  .map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Chart Type</Label>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger>
              <SelectValue placeholder="Select chart..." />
            </SelectTrigger>
            <SelectContent>
              {availableChartOptions.length === 0 && (
                <SelectItem value="none" disabled>
                  No chart available
                </SelectItem>
              )}
              {availableChartOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {xColumn && (
            <p className="text-xs text-muted-foreground">
              Detected type: {columnTypes[xColumn] || "other"}
              {mode === "bivariate" && yColumn
                ? ` / ${columnTypes[yColumn] || "other"}`
                : ""}
            </p>
          )}
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={!canGenerate}
          onClick={() => setChartReady(true)}
        >
          Generate Chart
        </Button>
      </div>
    </ActionSidebarItem>,
  );

  return (
    <FileLayout actions={actions}>
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between flex-shrink-0 px-6 pt-4 pb-2">
          <div>
            <h2 className="text-2xl font-semibold">Visualization</h2>
            <p className="text-sm text-muted-foreground">
              {fileData
                ? `Viewing ${fileData.rows.length} rows and ${fileData.columns.length} columns (read-only)`
                : "Load a file to begin visualizing data."}
            </p>
          </div>
        </div>

        {!activeFileId && (
          <Alert variant="destructive" className="flex-shrink-0 mx-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No file selected</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Please open a dataset from the Home page first.</p>
              <Button onClick={() => navigate("/")} variant="outline" size="sm">
                Back to Home
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoadingData && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-muted-foreground">Loading data...</span>
          </div>
        )}

        {dataError && (
          <Alert variant="destructive" className="flex-shrink-0 mx-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading file</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{(dataError as Error).message}</p>
              <div className="flex gap-2">
                <Button onClick={() => refetchData()} variant="outline" size="sm">
                  Retry
                </Button>
                <Button onClick={() => navigate("/")} variant="outline" size="sm">
                  Back to Home
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {fileData && !isLoadingData && !dataError && activeFileId && (
          <div className="flex-1 min-h-0 px-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Chart Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canGenerate && chartReady && chartOption ? (
                  <ReactECharts
                    option={chartOption}
                    style={{ height: 360, width: "100%" }}
                    opts={{ renderer: "svg" }}
                  />
                ) : (
                  <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground">
                    Select columns and a chart type, then click Generate Chart.
                  </div>
                )}

                {stats.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {stats.map(({ label, stats: stat }) => (
                      <Card key={label}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{label} quick stats</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Count</p>
                              <p className="font-medium">{stat.count}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Missing</p>
                              <p className="font-medium">{stat.missing}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Unique</p>
                              <p className="font-medium">{stat.unique}</p>
                            </div>
                            {stat.mean !== undefined && (
                              <div>
                                <p className="text-muted-foreground">Mean</p>
                                <p className="font-medium">{formatNumber(stat.mean)}</p>
                              </div>
                            )}
                            {stat.median !== undefined && (
                              <div>
                                <p className="text-muted-foreground">Median</p>
                                <p className="font-medium">{formatNumber(stat.median)}</p>
                              </div>
                            )}
                            {stat.mode && (
                              <div>
                                <p className="text-muted-foreground">Mode</p>
                                <p className="font-medium truncate" title={stat.mode}>{stat.mode}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
              </CardHeader>
              <CardContent className="h-[360px]">
                <DataTable columns={fileData.columns} rows={fileData.rows} readOnly />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </FileLayout>
  );
}
