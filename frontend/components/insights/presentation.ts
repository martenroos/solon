import type { InsightOption, InsightType } from "@/components/insights/types";

export function typeLabel(type: InsightType) {
  if (type === "prediction") return "Prediction";
  if (type === "anomaly") return "Anomaly";
  return "Insight";
}

export function typeBadge(type: InsightType): "default" | "gold" | "muted" {
  if (type === "prediction") return "gold";
  if (type === "anomaly") return "muted";
  return "default";
}

export function filterTone(active: boolean) {
  return active
    ? "border-primary/20 bg-primary/10 text-foreground"
    : "border-border/70 bg-background/75 text-muted-foreground hover:bg-background hover:text-foreground";
}

export function statusTone(status: InsightOption["status"]) {
  if (status === "Alert") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  if (status === "Watch") {
    return "border-[#C2A36B]/20 bg-[#C2A36B]/10 text-[#8A6A35]";
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export function deltaTone(direction: InsightOption["deltaDirection"]) {
  if (direction === "up") return "text-emerald-600 dark:text-emerald-300";
  if (direction === "down") return "text-destructive";
  return "text-muted-foreground";
}

export function segmentColor(index: number) {
  return [
    "var(--color-chart-2)",
    "var(--color-chart-5)",
    "var(--color-chart-1)",
    "var(--color-chart-4)",
    "var(--color-chart-3)",
  ][index % 5];
}
