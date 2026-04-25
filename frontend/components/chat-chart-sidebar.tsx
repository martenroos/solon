"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendChatChart } from "@/lib/backend";

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type ChatChartSidebarProps = {
  charts: BackendChatChart[];
};

const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 12 };
const tooltipContentStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "0.875rem",
  background: "color-mix(in srgb, var(--color-background) 88%, white)",
  color: "var(--color-foreground)",
};
const tooltipLabelStyle = { color: "var(--color-foreground)", fontWeight: 600 };
const tooltipItemStyle = { color: "var(--color-foreground)" };
const legendWrapperStyle = { fontSize: "11px", lineHeight: "16px" };

function getSeriesColor(color: string | null | undefined, index: number) {
  return color ?? chartColors[index % chartColors.length];
}

function coerceNumericValue(value: string | number | boolean | null | undefined) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return value;
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (typeof value === "number") {
    return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return value == null ? "" : String(value);
}

function normalizeChart(chart: BackendChatChart) {
  const numericKeys = new Set<string>();

  for (const series of chart.series) {
    numericKeys.add(series.key);
  }

  if (chart.value_key) {
    numericKeys.add(chart.value_key);
  }

  const data = chart.data.map((entry) => {
    const nextEntry: Record<string, string | number | boolean | null> = { ...entry };
    for (const key of numericKeys) {
      const normalizedValue = coerceNumericValue(nextEntry[key]);
      nextEntry[key] = normalizedValue === undefined ? null : normalizedValue;
    }
    return nextEntry;
  });

  return {
    ...chart,
    data,
  };
}

function renderChartValues(chart: BackendChatChart) {
  const normalizedChart = normalizeChart(chart);
  const xKey = normalizedChart.x_key ?? normalizedChart.label_key ?? "label";
  const rows = normalizedChart.data.slice(0, 6);
  const valueKeys =
    normalizedChart.type === "pie"
      ? [normalizedChart.value_key ?? normalizedChart.series[0]?.key ?? "value"]
      : normalizedChart.series.map((series) => series.key);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/70">
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,0.8fr))] gap-px bg-border/70 text-[11px]">
        <div className="bg-background px-2 py-2 font-medium text-foreground">{xKey}</div>
        {valueKeys.slice(0, 2).map((valueKey) => (
          <div key={valueKey} className="bg-background px-2 py-2 text-right font-medium text-foreground">
            {normalizedChart.series.find((series) => series.key === valueKey)?.label ?? valueKey}
          </div>
        ))}
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((entry, index) => (
          <div
            key={`${chart.id}-row-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,0.8fr))] gap-2 px-2 py-2 text-[11px]"
          >
            <div className="truncate text-muted-foreground">{formatValue(entry[xKey])}</div>
            {valueKeys.slice(0, 2).map((valueKey) => (
              <div key={valueKey} className="text-right text-foreground">
                {formatValue(entry[valueKey])}
              </div>
            ))}
          </div>
        ))}
      </div>
      {chart.data.length > rows.length ? (
        <div className="border-t border-border/60 px-2 py-2 text-[11px] text-muted-foreground">
          Showing {rows.length} of {normalizedChart.data.length} rows.
        </div>
      ) : null}
    </div>
  );
}

function renderChart(chart: BackendChatChart) {
  const normalizedChart = normalizeChart(chart);
  const xKey = normalizedChart.x_key ?? normalizedChart.label_key ?? undefined;

  if (normalizedChart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={normalizedChart.data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend wrapperStyle={legendWrapperStyle} />
          {normalizedChart.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={getSeriesColor(series.color, index)}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            >
              <LabelList
                dataKey={series.key}
                position="top"
                formatter={(value: unknown) =>
                  formatValue(value as string | number | boolean | null)
                }
                fill="var(--color-foreground)"
                fontSize={11}
              />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (normalizedChart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={normalizedChart.data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend wrapperStyle={legendWrapperStyle} />
          {normalizedChart.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={getSeriesColor(series.color, index)}
              radius={[6, 6, 0, 0]}
              stackId={normalizedChart.stacked ? "stack" : undefined}
            >
              <LabelList
                dataKey={series.key}
                position="top"
                formatter={(value: unknown) =>
                  formatValue(value as string | number | boolean | null)
                }
                fill="var(--color-foreground)"
                fontSize={11}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (normalizedChart.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={normalizedChart.data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend wrapperStyle={legendWrapperStyle} />
          {normalizedChart.series.map((series, index) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={getSeriesColor(series.color, index)}
              fill={getSeriesColor(series.color, index)}
              fillOpacity={0.22}
              stackId={normalizedChart.stacked ? "stack" : undefined}
            >
              <LabelList
                dataKey={series.key}
                position="top"
                formatter={(value: unknown) =>
                  formatValue(value as string | number | boolean | null)
                }
                fill="var(--color-foreground)"
                fontSize={11}
              />
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const labelKey = normalizedChart.label_key ?? "label";
  const valueKey = normalizedChart.value_key ?? normalizedChart.series[0]?.key ?? "value";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Tooltip
          formatter={(value) => formatValue(value as string | number | boolean | null)}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
        />
        <Legend wrapperStyle={legendWrapperStyle} />
        <Pie
          data={normalizedChart.data}
          dataKey={valueKey}
          nameKey={labelKey}
          innerRadius={44}
          outerRadius={78}
          paddingAngle={2}
          label={({ name, value }) => `${String(name)}: ${formatValue(value as string | number | boolean | null)}`}
        >
          {normalizedChart.data.map((entry, index) => (
            <Cell
              key={`${normalizedChart.id}-${String(entry[labelKey] ?? index)}`}
              fill={getSeriesColor(normalizedChart.series[index]?.color, index)}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChatChartList({ charts }: ChatChartSidebarProps) {
  const orderedCharts = [...charts].reverse();

  return (
    <div className="space-y-4">
      {orderedCharts.map((chart) => (
        <div
          key={chart.id}
          className="rounded-2xl border border-border/70 bg-background/75 p-3"
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">{chart.title}</h3>
            {chart.description ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{chart.description}</p>
            ) : null}
          </div>
          {renderChart(chart)}
          {renderChartValues(chart)}
        </div>
      ))}
      {orderedCharts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-4 py-6 text-sm text-muted-foreground">
          Ask for a chart and the agent can add one to this sidebar.
        </div>
      ) : null}
    </div>
  );
}

export function ChatChartSidebar({ charts }: ChatChartSidebarProps) {
  return (
    <aside className="w-full shrink-0 xl:w-[22rem]">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-base">Charts</CardTitle>
          <CardDescription>
            Visuals created during the conversation appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
          <ChatChartList charts={charts} />
        </CardContent>
      </Card>
    </aside>
  );
}
