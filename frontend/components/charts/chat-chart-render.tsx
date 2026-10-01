"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

import { chartSeriesColor } from "@/components/charts/palette";
import type { BackendChatChart } from "@/lib/backend";

import { formatValue, normalizeChart } from "./chart-format";

const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 12 };
const tooltipContentStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "0.875rem",
  background: "color-mix(in srgb, var(--color-background) 88%, white)",
  color: "var(--color-foreground)",
};
const tooltipLabelStyle = { color: "var(--color-foreground)", fontWeight: 600 };
const tooltipItemStyle = { color: "var(--color-foreground)" };

function getSeriesColor(color: string | null | undefined, index: number) {
  return color ?? chartSeriesColor(index);
}

// Recharts' default Legend colors the label text by the series color — some of
// those colors are validated for 3:1 mark contrast, not the stricter 4.5:1 text
// bar (gold reads 3.59:1 as text on the light surface). Identity should come
// from the swatch; the label stays in the app's own muted-foreground ink.
function ChartLegendContent({
  payload,
}: {
  payload?: Array<{ value?: string | number; color?: string }>;
}) {
  if (!payload?.length) return null;

  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {payload.map((entry, index) => (
        <li key={`${String(entry.value)}-${index}`} className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

export function renderChartValues(chart: BackendChatChart) {
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

export function renderChart(chart: BackendChatChart) {
  const normalizedChart = normalizeChart(chart);
  const xKey = normalizedChart.x_key ?? normalizedChart.label_key ?? undefined;

  if (normalizedChart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={normalizedChart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend content={<ChartLegendContent />} />
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
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (normalizedChart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={normalizedChart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend content={<ChartLegendContent />} />
          {normalizedChart.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={getSeriesColor(series.color, index)}
              radius={[6, 6, 0, 0]}
              maxBarSize={24}
              stackId={normalizedChart.stacked ? "stack" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (normalizedChart.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={normalizedChart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickFormatter={formatValue} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value) => formatValue(value as string | number | boolean | null)}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Legend content={<ChartLegendContent />} />
          {normalizedChart.series.map((series, index) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={getSeriesColor(series.color, index)}
              fill={getSeriesColor(series.color, index)}
              fillOpacity={0.15}
              strokeWidth={2}
              stackId={normalizedChart.stacked ? "stack" : undefined}
            />
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
        <Legend content={<ChartLegendContent />} />
        <Pie
          data={normalizedChart.data}
          dataKey={valueKey}
          nameKey={labelKey}
          innerRadius={44}
          outerRadius={78}
          paddingAngle={2}
          fill={chartSeriesColor(0)}
          stroke="var(--color-background)"
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
