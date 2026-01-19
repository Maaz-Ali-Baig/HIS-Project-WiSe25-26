import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlotResponse } from "../api/visualization";
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
  LineChart,
  Line,
  ComposedChart,
} from "recharts";

const palette = [
  "#2563eb", "#16a34a", "#f97316", "#0ea5e9", "#ef4444",
  "#8b5cf6", "#14b8a6", "#f59e0b", "#06b6d4", "#ec4899",
];

interface Props {
  plotData: PlotResponse | null;
}

export function VisualizationDisplay({ plotData }: Props) {
  const renderStats = (stats?: Record<string, any>) => {
    if (!stats) return null;
    const entries = Object.entries(stats);
    if (entries.length === 0) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground mt-4">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <span className="capitalize text-muted-foreground">
              {key.replace(/_/g, " ")}
            </span>
            <span className="font-medium text-foreground text-sm">
              {typeof value === "number" ? value.toFixed(3) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    if (!plotData || !plotData.data) return null;
    const data = plotData.data;

    // Bar chart (with percents)
    if (plotData.chartType === "bar" || plotData.chartType === "topn_bar" || 
        plotData.chartType === "ordered_bar") {
      if (!data.categories || !data.counts || !data.percents) return null;
      
      const barData = data.categories.map((name: string, idx: number) => ({
        name,
        count: data.counts[idx],
        percent: data.percents[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip content={({ payload }) => {
              if (!payload?.[0]) return null;
              return (
                <div className="bg-background border rounded-lg p-2 shadow-lg">
                  <p className="font-medium">{payload[0].payload.name}</p>
                  <p className="text-sm">Count: {payload[0].payload.count}</p>
                  <p className="text-sm">Percent: {payload[0].payload.percent}%</p>
                </div>
              );
            }} />
            <Bar dataKey="count" fill={palette[0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Pareto chart
    if (plotData.chartType === "pareto") {
      if (!data.categories || !data.counts || !data.percents || !data.cum_percent) return null;
      
      const paretoData = data.categories.map((name: string, idx: number) => ({
        name,
        count: data.counts[idx],
        percent: data.percents[idx],
        cumPercent: data.cum_percent[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={paretoData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="count" fill={palette[0]} name="Count" />
            <Line yAxisId="right" type="monotone" dataKey="cumPercent" stroke={palette[4]} strokeWidth={2} name="Cumulative %" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Cumulative percent
    if (plotData.chartType === "cumulative_percent") {
      if (!data.categories || !data.percents || !data.cum_percent) return null;
      
      const cumulativeData = data.categories.map((name: string, idx: number) => ({
        name,
        percent: data.percents[idx],
        cumPercent: data.cum_percent[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cumPercent" stroke={palette[0]} strokeWidth={2} name="Cumulative %" />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Pie chart
    if (plotData.chartType === "pie") {
      if (!data.categories || !data.counts) return null;
      
      const pieData = data.categories.map((name: string, idx: number) => ({
        name,
        value: data.counts[idx],
      }));

      return (
        <ResponsiveContainer width="100%" height={500}>
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

    // Stacked bar 100% or grouped bar
    if (plotData.chartType === "stacked_bar_100" || plotData.chartType === "grouped_bar" ||
        plotData.chartType === "stacked_bar") {
      const xCategories = data.x_categories || [];
      const series = data.series || [];
      const stackedData = xCategories.map((category: string, idx: number) => {
        const row: Record<string, any> = { category };
        series.forEach((s: any) => {
          row[s.name] = plotData.chartType === "stacked_bar_100" 
            ? s.percent_within_x[idx] 
            : s.counts[idx];
        });
        return row;
      });

      return (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={stackedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s: any, idx: number) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                stackId={plotData.chartType === "stacked_bar" || plotData.chartType === "stacked_bar_100" ? "a" : undefined}
                fill={palette[idx % palette.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Histogram
    if (plotData.chartType === "histogram") {
      const histogramData = data.bins.map(
        (bin: { start: number; end: number; count: number }) => ({
          range: `${bin.start.toFixed(2)}-${bin.end.toFixed(2)}`,
          count: bin.count,
        })
      );

      return (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={histogramData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill={palette[2]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // QQ Plot
    if (plotData.chartType === "qq" || plotData.chartType === "qqline") {
      const points = data.points || [];
      const line = data.line || null;

      return (
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="theoretical" type="number" name="Theoretical Quantile" />
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

    // Scatter plot
    if (plotData.chartType === "scatter") {
      const points = data.points || [];
      return (
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" name={plotData.xColumn || "X"} />
            <YAxis dataKey="y" type="number" name={plotData.yColumn || "Y"} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} fill={palette[1]} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // Contingency Heatmap
    if (plotData.chartType === "contingency_heatmap_percent") {
      if (!data.x_categories || !data.y_categories || !data.percents) return null;

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted font-semibold"></th>
                  {data.y_categories.map((ycat: string) => (
                    <th key={ycat} className="border p-2 bg-muted font-semibold">{ycat}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.x_categories.map((xcat: string, xIdx: number) => (
                  <tr key={xcat}>
                    <td className="border p-2 bg-muted font-semibold">{xcat}</td>
                    {data.y_categories.map((ycat: string, yIdx: number) => {
                      const percent = data.percents[xcat]?.[yIdx] || 0;
                      const count = data.counts[xcat]?.[yIdx] || 0;
                      const intensity = Math.min(percent / 100, 1);
                      const bgColor = `rgba(239, 68, 68, ${intensity * 0.7 + 0.1})`;
                      
                      return (
                        <td 
                          key={`${xcat}-${ycat}`} 
                          className="border p-2 text-center"
                          style={{ backgroundColor: bgColor }}
                        >
                          <div className="font-medium">{percent.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">({count})</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground">
            Percentage mode: {data.percent_mode === 'row' ? 'Row % (within X)' : 'Column % (within Y)'}
          </div>
        </div>
      );
    }

    // Likert Diverging
    if (plotData.chartType === "likert_diverging") {
      if (!data.groups || !data.data) return null;

      const likertData = data.data.map((item: any) => ({
        name: item.group,
        negative: -item.negative_percent,
        neutral: item.neutral_percent,
        positive: item.positive_percent,
      }));

      return (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={likertData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[-100, 100]} />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip content={({ payload }) => {
                if (!payload?.[0]) return null;
                const item = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg p-2 shadow-lg">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-red-600">Negative: {Math.abs(item.negative).toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">Neutral: {item.neutral.toFixed(1)}%</p>
                    <p className="text-sm text-green-600">Positive: {item.positive.toFixed(1)}%</p>
                  </div>
                );
              }} />
              <Legend />
              <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" />
              <Bar dataKey="neutral" stackId="a" fill="#9ca3af" name="Neutral" />
              <Bar dataKey="positive" stackId="a" fill="#10b981" name="Positive" />
              <ReferenceLine x={0} stroke="#000" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground">
            Neutral value: {data.neutral_value} | Scale: {data.levels?.join(' < ')}
          </div>
        </div>
      );
    }

    // Association target bar
    if (plotData.chartType === "assoc_target_bar") {
      const assocData = data.associations.map((a: any) => ({
        column: a.column,
        value: a.assoc_value,
      }));

      return (
        <div style={{ width: '100%', height: 500, overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={assocData} layout="vertical" margin={{ left: 10, right: 30, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 1]} />
              <YAxis 
                dataKey="column" 
                type="category" 
                width={280} 
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip />
              <Bar dataKey="value" fill={palette[5]} name={`Association with ${data.target_column}`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Visualization Output</CardTitle>
        <CardDescription>
          {plotData 
            ? `${plotData.chartType} chart` + (plotData.xColumn ? ` for ${plotData.xColumn}` : "")
            : "Select a visualization technique from the sidebar to generate a plot"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {plotData ? (
          <div className="space-y-4">
            {renderChart()}
            {renderStats(plotData.data?.stats)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-muted-foreground">
            No visualization generated yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
