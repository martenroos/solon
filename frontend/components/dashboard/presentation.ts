import {
  Activity,
  BarChart3,
  CircleAlert,
  DatabaseZap,
  DollarSign,
  HandCoins,
  Percent,
  RefreshCcw,
  TrendingDown,
  Wallet,
} from "lucide-react";

export function getSeverityTone(severity: string) {
  if (severity === "Alert") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (severity === "Watch") {
    return "border-[#C2A36B]/20 bg-[#C2A36B]/10 text-[#8A6A35]";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export function getPriorityIcon(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("stale") || normalized.includes("sync")) return DatabaseZap;
  if (normalized.includes("receivable") || normalized.includes("overdue")) return HandCoins;
  if (normalized.includes("margin")) return TrendingDown;
  if (normalized.includes("ap")) return Wallet;
  return CircleAlert;
}

export function getKpiIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("revenue")) return DollarSign;
  // Neutral icons: direction is shown by the delta and status, not hard-coded per KPI.
  if (normalized.includes("ebitda")) return Activity;
  if (normalized.includes("margin")) return Percent;
  if (normalized.includes("cash")) return Wallet;
  if (normalized.includes("ar")) return HandCoins;
  if (normalized.includes("budget")) return BarChart3;
  if (normalized.includes("sync")) return RefreshCcw;
  return CircleAlert;
}

export function getDeltaTone(delta: string, status: string) {
  if (status === "Alert") return "text-destructive";
  if (status === "Watch") return "text-[#8A6A35]";
  if (delta.startsWith("-") || delta.includes("n/a")) return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-300";
}
