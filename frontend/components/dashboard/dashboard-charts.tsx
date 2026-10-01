"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { chartSeriesColor } from "@/components/charts/palette";
import { MiniAreaChart } from "@/components/charts/mini-area-chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { BackendFinanceCashForecastPoint, BackendFinanceRevenueMarginPoint } from "@/lib/backend";

const revenueConfig = {
  value: { label: "Revenue (€m)", color: chartSeriesColor(0) },
} satisfies ChartConfig;

export function RevenueMarginChart({ data }: { data: BackendFinanceRevenueMarginPoint[] }) {
  const labels = data.map((point) => point.label);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Revenue (€m)</p>
        <ChartContainer config={revenueConfig} className="mt-2 h-36 w-full">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={38}
              tickFormatter={(value: number) => `€${value}m`}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent config={revenueConfig} />} />
            <Bar dataKey="revenue" name="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      </div>

      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Margin (%)</p>
        <div className="mt-2 h-28">
          <MiniAreaChart
            values={data.map((point) => point.margin)}
            labels={labels}
            label="Margin (%)"
            color={chartSeriesColor(1)}
          />
        </div>
      </div>
    </div>
  );
}

const cashForecastConfig = {
  inflow: { label: "Inflow (€k)", color: chartSeriesColor(1) },
  outflow: { label: "Outflow (€k)", color: chartSeriesColor(4) },
} satisfies ChartConfig;

export function CashForecastChart({ data }: { data: BackendFinanceCashForecastPoint[] }) {
  return (
    <div>
      <ChartContainer config={cashForecastConfig} className="h-36 w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={34}
            tickFormatter={(value: number) => `€${value}k`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          />
          <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent config={cashForecastConfig} />} />
          <Bar dataKey="inflow" name="inflow" fill="var(--color-inflow)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="outflow" name="outflow" fill="var(--color-outflow)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: chartSeriesColor(1) }} />
          Inflow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: chartSeriesColor(4) }} />
          Outflow
        </span>
      </div>
    </div>
  );
}
