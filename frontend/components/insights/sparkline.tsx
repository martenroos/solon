import { MiniAreaChart } from "@/components/charts/mini-area-chart";
import type { InsightOption } from "@/components/insights/types";

export function InsightSparkline({
  item,
  className = "h-full w-full",
}: {
  item: InsightOption;
  className?: string;
}) {
  const color =
    item.status === "Alert"
      ? "var(--destructive)"
      : item.category === "prediction"
        ? "var(--color-chart-5)"
        : "var(--color-chart-2)";

  return <MiniAreaChart values={item.trend} label={item.title} color={color} className={className} />;
}
