"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <div
      data-slot="chart"
      data-chart={chartId}
      className={cn(
        "flex justify-center text-xs [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none",
        className,
      )}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
    </div>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart=${id}] {
${colorConfig.map(([key, item]) => `  --color-${key}: ${item.color};`).join("\n")}
}
`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  className,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  label?: React.ReactNode;
  config: ChartConfig;
  className?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={cn("min-w-[108px] rounded-lg border border-border/70 bg-background px-2.5 py-2 shadow-md", className)}>
      {label ? <p className="mb-1 text-[10px] text-muted-foreground">{label}</p> : null}
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "");
        const entry = config[key];
        const value = typeof item.value === "number" ? item.value.toLocaleString() : item.value;

        return (
          <div key={key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-[2px]" style={{ backgroundColor: item.color ?? entry?.color }} />
              {entry?.label ?? item.name}
            </span>
            <span className="font-mono font-medium text-foreground">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
