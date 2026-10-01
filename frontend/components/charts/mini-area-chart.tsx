"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { chartSeriesColor } from "@/components/charts/palette";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export function MiniAreaChart({
  values,
  labels,
  label = "Value",
  color = chartSeriesColor(1),
  className = "h-full w-full",
}: {
  values: number[];
  labels?: string[];
  label?: string;
  color?: string;
  className?: string;
}) {
  const gradientId = useId();
  const safeValues = values.length ? values : [0];
  const data = safeValues.map((value, index) => ({
    label: labels?.[index] ?? `P${index + 1}`,
    value,
  }));
  const chartConfig = { value: { label, color } } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={className}>
      <AreaChart accessibilityLayer data={data} margin={{ top: 7, right: 3, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={5}
          interval="preserveStartEnd"
          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={4}
          tickCount={3}
          width={36}
          tickFormatter={formatAxisValue}
          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<ChartTooltipContent config={chartConfig} />}
        />
        <Area
          dataKey="value"
          type="monotone"
          fill={`url(#${gradientId})`}
          fillOpacity={1}
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function formatAxisValue(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
