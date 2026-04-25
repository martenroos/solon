"use client";

import { type ComponentType, startTransition, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BanknoteArrowDown,
  BanknoteArrowUp,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Combine,
  CreditCard,
  Diff,
  Expand,
  EyeOff,
  LayoutGrid,
  LineChart,
  RefreshCcw,
  ScanSearch,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type InsightType = "insight" | "prediction" | "anomaly";
type CardSize = "sm" | "md" | "lg";

type InsightOption = {
  id: string;
  title: string;
  category: InsightType;
  summary: string;
  detail: string;
  dataSources: string[];
  value: string;
  actionLabel: string;
  size: CardSize;
  metric: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
  status: "On track" | "Watch" | "Alert";
  trend: number[];
  segments?: { label: string; value: number; tone: string }[];
  icon: ComponentType<{ className?: string }>;
};

type TenantOption = {
  id: string;
  name: string;
  subtitle: string;
};

type TenantState = {
  visibleIds: string[];
  expandedIds: string[];
};

type TypeFilter = InsightType;
type StatusFilter = InsightOption["status"];

const TENANTS: TenantOption[] = [
  { id: "solon-group", name: "Solon Group", subtitle: "Group dashboard" },
  { id: "north-holding", name: "North Holding", subtitle: "Tenant dashboard" },
  { id: "canal-ventures", name: "Canal Ventures", subtitle: "Tenant dashboard" },
];

const INSIGHT_OPTIONS: InsightOption[] = [
  {
    id: "revenue-trend",
    title: "Revenue trend by period",
    category: "insight",
    summary: "Shows how revenue is moving by fiscal period, company, and org unit.",
    detail: "Useful as the base card for executive review and period-over-period trend interpretation.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account", "dim_org_unit"],
    value: "Trend",
    actionLabel: "Compare periods",
    size: "lg",
    metric: "€2.84M",
    delta: "+8.2% vs last period",
    deltaDirection: "up",
    status: "On track",
    trend: [42, 44, 48, 46, 51, 57, 61],
    icon: TrendingUp,
  },
  {
    id: "gross-margin",
    title: "Gross margin trend",
    category: "insight",
    summary: "Tracks revenue against direct cost groupings to explain margin movement.",
    detail: "This is where finance can isolate whether pressure comes from price, cost mix, or delivery cost drift.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account"],
    value: "Margin",
    actionLabel: "Inspect margin mix",
    size: "md",
    metric: "41.8%",
    delta: "-1.4 pts",
    deltaDirection: "down",
    status: "Watch",
    trend: [52, 50, 48, 47, 45, 43, 42],
    icon: Diff,
  },
  {
    id: "opex-run-rate",
    title: "Opex run-rate",
    category: "insight",
    summary: "Monitors operating expense burn by department and cost center.",
    detail: "Best used to frame whether current spend is pacing above plan before the month closes.",
    dataSources: ["fact_journal_entry_line", "dim_org_unit", "dim_ledger_account"],
    value: "Burn",
    actionLabel: "Review departments",
    size: "md",
    metric: "€918k",
    delta: "+6.1% vs plan",
    deltaDirection: "up",
    status: "Watch",
    trend: [58, 60, 63, 66, 67, 70, 73],
    icon: BriefcaseBusiness,
  },
  {
    id: "trial-balance-movement",
    title: "Trial balance movement",
    category: "insight",
    summary: "Summarizes account movement by fiscal period using the warehouse trial balance mart.",
    detail: "This gives controllers a compact way to see which balances materially shifted.",
    dataSources: ["mart.v_trial_balance_by_period"],
    value: "Control",
    actionLabel: "Open account movement",
    size: "md",
    metric: "17 accounts",
    delta: "3 material shifts",
    deltaDirection: "flat",
    status: "On track",
    trend: [28, 25, 27, 29, 31, 29, 30],
    icon: LayoutGrid,
  },
  {
    id: "budget-vs-actual",
    title: "Budget vs actual variance",
    category: "insight",
    summary: "Highlights where actual performance has drifted from plan by account and org unit.",
    detail: "Usually becomes the first card finance business partners want on a tenant dashboard.",
    dataSources: ["fact_budget", "mart.v_budget_vs_actual"],
    value: "Variance",
    actionLabel: "Review variance",
    size: "lg",
    metric: "€126k",
    delta: "4.8% above plan",
    deltaDirection: "down",
    status: "Watch",
    trend: [24, 30, 36, 42, 58, 73, 81],
    icon: CircleDollarSign,
  },
  {
    id: "customer-concentration",
    title: "Customer concentration risk",
    category: "insight",
    summary: "Measures how dependent receivables or revenue are on a small number of customers.",
    detail: "Strong for board and lender conversations because it exposes exposure concentration quickly.",
    dataSources: ["fact_sales_invoice", "dim_counterparty", "fact_open_item_snapshot"],
    value: "Risk",
    actionLabel: "View top customers",
    size: "sm",
    metric: "38%",
    delta: "Top 3 customers",
    deltaDirection: "flat",
    status: "Watch",
    trend: [34, 35, 36, 36, 37, 37, 38],
    segments: [
      { label: "Top 3", value: 38, tone: "bg-chart-1" },
      { label: "Next 7", value: 33, tone: "bg-chart-2" },
      { label: "Other", value: 29, tone: "bg-chart-4" },
    ],
    icon: Users,
  },
  {
    id: "supplier-concentration",
    title: "Supplier concentration risk",
    category: "insight",
    summary: "Shows whether vendor spend and payables are overly concentrated with a few suppliers.",
    detail: "Important for procurement risk and negotiation leverage monitoring.",
    dataSources: ["fact_purchase_invoice", "dim_counterparty", "fact_open_item_snapshot"],
    value: "Exposure",
    actionLabel: "View top suppliers",
    size: "sm",
    metric: "44%",
    delta: "Top 5 suppliers",
    deltaDirection: "flat",
    status: "Watch",
    trend: [40, 40, 41, 42, 43, 43, 44],
    segments: [
      { label: "Top 5", value: 44, tone: "bg-chart-5" },
      { label: "Mid tier", value: 31, tone: "bg-chart-2" },
      { label: "Tail", value: 25, tone: "bg-chart-3" },
    ],
    icon: ShoppingCart,
  },
  {
    id: "ar-aging",
    title: "AR aging composition",
    category: "insight",
    summary: "Breaks receivables into current and overdue buckets from the latest snapshot.",
    detail: "A core working-capital card that should usually stay pinned for finance teams.",
    dataSources: ["fact_open_item_snapshot", "mart.v_ar_aging_latest"],
    value: "AR",
    actionLabel: "Review receivables aging",
    size: "md",
    metric: "€612k",
    delta: "19% overdue",
    deltaDirection: "down",
    status: "Watch",
    trend: [22, 21, 24, 23, 22, 20, 19],
    segments: [
      { label: "Current", value: 81, tone: "bg-chart-2" },
      { label: "Overdue", value: 19, tone: "bg-chart-1" },
    ],
    icon: BanknoteArrowUp,
  },
  {
    id: "ap-aging",
    title: "AP aging composition",
    category: "insight",
    summary: "Shows payable timing pressure and how much supplier balance is already overdue.",
    detail: "Helps treasury and finance ops manage payment timing without losing control of vendor risk.",
    dataSources: ["fact_open_item_snapshot", "mart.v_ap_aging_latest"],
    value: "AP",
    actionLabel: "Review payables aging",
    size: "md",
    metric: "€481k",
    delta: "12% overdue",
    deltaDirection: "flat",
    status: "On track",
    trend: [16, 15, 15, 14, 14, 13, 12],
    segments: [
      { label: "Current", value: 88, tone: "bg-chart-2" },
      { label: "Overdue", value: 12, tone: "bg-chart-5" },
    ],
    icon: BanknoteArrowDown,
  },
  {
    id: "working-capital",
    title: "Working capital trend",
    category: "insight",
    summary: "Tracks receivables, payables, overdue balances, and their movement over time.",
    detail: "This is the most compact lens into operating discipline and cash conversion quality.",
    dataSources: ["fact_open_item_snapshot", "fact_sales_invoice", "fact_purchase_invoice"],
    value: "Cash cycle",
    actionLabel: "Open working capital",
    size: "lg",
    metric: "34 days",
    delta: "-3 days improvement",
    deltaDirection: "up",
    status: "On track",
    trend: [41, 40, 39, 38, 37, 35, 34],
    icon: Wallet,
  },
  {
    id: "cash-collection-forecast",
    title: "Cash collection forecast",
    category: "prediction",
    summary: "Predicts expected cash-in by week or month from receivables behavior and invoice aging.",
    detail: "This is the first predictive module most BI teams build because the business value is immediate.",
    dataSources: ["fact_sales_invoice", "fact_open_item_snapshot", "dim_counterparty"],
    value: "Forecast",
    actionLabel: "Forecast cash-in",
    size: "lg",
    metric: "€1.12M",
    delta: "Next 30 days",
    deltaDirection: "up",
    status: "On track",
    trend: [52, 58, 61, 67, 73, 76, 81],
    icon: LineChart,
  },
  {
    id: "supplier-payment-forecast",
    title: "Supplier payment forecast",
    category: "prediction",
    summary: "Projects expected cash-out from open AP, invoice due dates, and supplier behavior.",
    detail: "Useful for treasury planning and short-horizon cash management.",
    dataSources: ["fact_purchase_invoice", "fact_open_item_snapshot", "dim_counterparty"],
    value: "Forecast",
    actionLabel: "Forecast cash-out",
    size: "md",
    metric: "€746k",
    delta: "Next 30 days",
    deltaDirection: "flat",
    status: "Watch",
    trend: [44, 48, 47, 53, 56, 55, 59],
    icon: ArrowDownUp,
  },
  {
    id: "revenue-forecast",
    title: "Revenue forecast",
    category: "prediction",
    summary: "Projects near-term revenue using posting history and seasonal period patterns.",
    detail: "This usually becomes more stable once enough historical periods accumulate in the warehouse.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account", "dim_date"],
    value: "Projection",
    actionLabel: "Project revenue",
    size: "md",
    metric: "€3.06M",
    delta: "+7.4% projected",
    deltaDirection: "up",
    status: "On track",
    trend: [38, 42, 46, 51, 55, 59, 64],
    icon: TrendingUp,
  },
  {
    id: "expense-forecast",
    title: "Expense forecast",
    category: "prediction",
    summary: "Forecasts next-month or next-quarter spend by account class and org unit.",
    detail: "Strong for early warning when burn is compounding before a formal reforecast.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account", "dim_org_unit"],
    value: "Projection",
    actionLabel: "Project spend",
    size: "md",
    metric: "€1.42M",
    delta: "+5.2% projected",
    deltaDirection: "down",
    status: "Watch",
    trend: [41, 43, 46, 49, 54, 57, 60],
    icon: TrendingDown,
  },
  {
    id: "budget-overrun-risk",
    title: "Budget overrun prediction",
    category: "prediction",
    summary: "Estimates which accounts or departments are likely to miss budget before period close.",
    detail: "Especially valuable when budgets are loaded monthly but review cadence is weekly.",
    dataSources: ["fact_budget", "fact_journal_entry_line", "dim_org_unit"],
    value: "Risk score",
    actionLabel: "Find overrun risk",
    size: "sm",
    metric: "3 teams",
    delta: "High risk",
    deltaDirection: "down",
    status: "Alert",
    trend: [1, 1, 2, 2, 2, 3, 3],
    icon: ShieldAlert,
  },
  {
    id: "overdue-risk",
    title: "Overdue invoice risk prediction",
    category: "prediction",
    summary: "Scores receivables by their likelihood of slipping into overdue status.",
    detail: "Lets credit control intervene before aging worsens instead of after the fact.",
    dataSources: ["fact_sales_invoice", "fact_open_item_snapshot", "dim_counterparty"],
    value: "Collections",
    actionLabel: "Prioritize follow-up",
    size: "sm",
    metric: "14 invoices",
    delta: "Likely overdue",
    deltaDirection: "down",
    status: "Alert",
    trend: [7, 8, 8, 10, 11, 13, 14],
    icon: CreditCard,
  },
  {
    id: "abnormal-journal-amounts",
    title: "Abnormal journal amount detection",
    category: "anomaly",
    summary: "Flags unusually large or unusual debit, credit, or signed amounts for the posting context.",
    detail: "This is the most direct anomaly rule because the grain already exists at journal line level.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account", "dim_org_unit", "dim_counterparty"],
    value: "Outliers",
    actionLabel: "Inspect outliers",
    size: "lg",
    metric: "27 lines",
    delta: "9 severe flags",
    deltaDirection: "down",
    status: "Alert",
    trend: [6, 9, 11, 15, 18, 23, 27],
    icon: AlertTriangle,
  },
  {
    id: "duplicate-postings",
    title: "Duplicate posting detection",
    category: "anomaly",
    summary: "Looks for repeated invoice or journal patterns that suggest duplicates or re-loads.",
    detail: "Can combine source identifiers with near-duplicate business fields like amount and date.",
    dataSources: ["fact_journal_entry", "fact_journal_entry_line", "fact_sales_invoice", "fact_purchase_invoice"],
    value: "Duplicates",
    actionLabel: "Review duplicates",
    size: "md",
    metric: "8 matches",
    delta: "2 new today",
    deltaDirection: "down",
    status: "Watch",
    trend: [2, 3, 3, 4, 5, 6, 8],
    icon: Combine,
  },
  {
    id: "unusual-posting-combos",
    title: "Unusual posting combination detection",
    category: "anomaly",
    summary: "Flags rare combinations of account, counterparty, journal, tax code, and document type.",
    detail: "This catches behavior that is not individually extreme but still operationally suspicious.",
    dataSources: ["fact_journal_entry_line", "dim_journal", "dim_tax_code", "dim_document_type"],
    value: "Novelty",
    actionLabel: "Review unusual combinations",
    size: "md",
    metric: "11 combos",
    delta: "Rare this week",
    deltaDirection: "down",
    status: "Watch",
    trend: [4, 4, 5, 7, 8, 9, 11],
    icon: ScanSearch,
  },
  {
    id: "data-freshness",
    title: "Data freshness and sync anomaly detection",
    category: "anomaly",
    summary: "Alerts on stale loads, failed syncs, missing source volume, and connector drift.",
    detail: "This should be part of every tenant dashboard because trust in insight depends on freshness first.",
    dataSources: ["sync_run", "sync_cursor", "raw_object", "mart.v_data_freshness"],
    value: "Ops",
    actionLabel: "Check freshness",
    size: "lg",
    metric: "2 stale feeds",
    delta: "Last sync 47m ago",
    deltaDirection: "down",
    status: "Alert",
    trend: [1, 1, 2, 1, 2, 2, 2],
    icon: RefreshCcw,
  },
];

const DEFAULT_VISIBLE_IDS = INSIGHT_OPTIONS.map((item) => item.id);

function getStorageKey(tenantId: string) {
  return `solon-insights-layout:${tenantId}`;
}

function getInitialTenantState(): Record<string, TenantState> {
  if (typeof window === "undefined") {
    return Object.fromEntries(
      TENANTS.map((tenant) => [tenant.id, { visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [] }]),
    );
  }

  return Object.fromEntries(
    TENANTS.map((tenant) => {
      const storedValue = window.localStorage.getItem(getStorageKey(tenant.id));

      if (!storedValue) {
        return [tenant.id, { visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [] }];
      }

      try {
        const parsed = JSON.parse(storedValue) as Partial<TenantState>;
        const visibleIds = Array.isArray(parsed.visibleIds)
          ? parsed.visibleIds.filter((id) => DEFAULT_VISIBLE_IDS.includes(id))
          : DEFAULT_VISIBLE_IDS;
        const expandedIds = Array.isArray(parsed.expandedIds)
          ? parsed.expandedIds.filter((id) => visibleIds.includes(id))
          : [];

        return [
          tenant.id,
          {
            visibleIds: visibleIds.length > 0 ? visibleIds : DEFAULT_VISIBLE_IDS,
            expandedIds,
          },
        ];
      } catch {
        return [tenant.id, { visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [] }];
      }
    }),
  );
}

function getTypeLabel(category: InsightType) {
  if (category === "prediction") return "Prediction";
  if (category === "anomaly") return "Anomaly";
  return "Insight";
}

function getTypeBadgeVariant(category: InsightType): "default" | "gold" | "muted" {
  if (category === "prediction") return "gold";
  if (category === "anomaly") return "muted";
  return "default";
}

function getCardSpan(size: CardSize, expanded: boolean) {
  if (expanded) {
    return "md:col-span-2 xl:col-span-4";
  }

  if (size === "lg") {
    return "md:col-span-2 xl:col-span-2";
  }

  if (size === "md") {
    return "md:col-span-1 xl:col-span-2";
  }

  return "md:col-span-1 xl:col-span-1";
}

function getStatusTone(status: InsightOption["status"]) {
  if (status === "Alert") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (status === "Watch") {
    return "border-[#C2A36B]/20 bg-[#C2A36B]/10 text-[#8A6A35]";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function getDeltaTone(direction: InsightOption["deltaDirection"]) {
  if (direction === "up") return "text-emerald-600 dark:text-emerald-300";
  if (direction === "down") return "text-destructive";
  return "text-muted-foreground";
}

function getFilterButtonTone(active: boolean) {
  return active
    ? "border-primary/20 bg-primary/10 text-foreground"
    : "border-border/70 bg-background/75 text-muted-foreground hover:bg-background hover:text-foreground";
}

function getChartTone(category: InsightType, status: InsightOption["status"]) {
  if (status === "Alert") {
    return {
      color: "var(--destructive)",
      surface: "from-destructive/12 via-destructive/6 to-transparent",
      glow: "shadow-[0_20px_50px_-28px_hsl(var(--destructive)/0.55)]",
    };
  }

  if (category === "prediction") {
    return {
      color: "var(--color-chart-5)",
      surface: "from-chart-5/16 via-chart-5/6 to-transparent",
      glow: "shadow-[0_20px_50px_-28px_hsl(var(--chart-5)/0.45)]",
    };
  }

  if (category === "anomaly") {
    return {
      color: "var(--color-chart-1)",
      surface: "from-chart-1/16 via-chart-1/6 to-transparent",
      glow: "shadow-[0_20px_50px_-28px_hsl(var(--chart-1)/0.42)]",
    };
  }

  return {
    color: "var(--color-chart-2)",
    surface: "from-chart-2/16 via-chart-2/6 to-transparent",
    glow: "shadow-[0_20px_50px_-28px_hsl(var(--chart-2)/0.42)]",
  };
}

function buildSparklineCoordinates(values: number[]) {
  const width = 100;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return { x, y };
    });
}

function buildSparklinePath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildSparklinePath(points);
  return `${linePath} L ${points[points.length - 1]?.x ?? 100} 44 L ${points[0]?.x ?? 0} 44 Z`;
}

function summarizeTrend(values: number[]) {
  const current = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? current;
  const baseline = values.at(0) ?? current;

  return {
    current,
    min: Math.min(...values),
    max: Math.max(...values),
    delta: current - previous,
    net: current - baseline,
  };
}

function getDeltaPrefix(value: number) {
  if (value > 0) return "+";
  if (value < 0) return "";
  return "";
}

function getSegmentTone(index: number) {
  return ["bg-chart-2", "bg-chart-5", "bg-chart-1", "bg-chart-4", "bg-chart-3"][index % 5];
}

function getSegmentColor(index: number) {
  return [
    "var(--color-chart-2)",
    "var(--color-chart-5)",
    "var(--color-chart-1)",
    "var(--color-chart-4)",
    "var(--color-chart-3)",
  ][index % 5];
}

function getPeriodLabels(length: number) {
  if (length === 7) {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  }

  return Array.from({ length }, (_, index) => `P${index + 1}`);
}

export function InsightsDashboard() {
  const [selectedTenantId, setSelectedTenantId] = useState(TENANTS[0].id);
  const [tenantState, setTenantState] = useState<Record<string, TenantState>>(getInitialTenantState);
  const [isSelectorOpen, setIsSelectorOpen] = useState(true);
  const [typeFilters, setTypeFilters] = useState<TypeFilter[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);

  useEffect(() => {
    for (const [tenantId, state] of Object.entries(tenantState)) {
      window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(state));
    }
  }, [tenantState]);

  const activeTenantState = tenantState[selectedTenantId] ?? {
    visibleIds: DEFAULT_VISIBLE_IDS,
    expandedIds: [],
  };

  const configuredCards = useMemo(() => {
    const order = new Map(INSIGHT_OPTIONS.map((item, index) => [item.id, index]));

    return INSIGHT_OPTIONS.filter((item) => activeTenantState.visibleIds.includes(item.id)).sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
    );
  }, [activeTenantState.visibleIds]);

  const visibleCards = useMemo(() => {
    return configuredCards.filter((item) => {
      const matchesType = typeFilters.length === 0 || typeFilters.includes(item.category);
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(item.status);
      return matchesType && matchesStatus;
    });
  }, [configuredCards, statusFilters, typeFilters]);

  const counts = useMemo(() => {
    return configuredCards.reduce(
      (result, card) => {
        result[card.category] += 1;
        return result;
      },
      { insight: 0, prediction: 0, anomaly: 0 },
    );
  }, [configuredCards]);

  function toggleTypeFilter(filter: TypeFilter) {
    setTypeFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
  }

  function toggleStatusFilter(filter: StatusFilter) {
    setStatusFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
  }

  function clearFilters() {
    setTypeFilters([]);
    setStatusFilters([]);
  }

  function updateTenantState(updater: (current: TenantState) => TenantState) {
    startTransition(() => {
      setTenantState((current) => {
        const existing = current[selectedTenantId] ?? { visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [] };

        return {
          ...current,
          [selectedTenantId]: updater(existing),
        };
      });
    });
  }

  function toggleCardVisibility(cardId: string) {
    updateTenantState((current) => {
      const isVisible = current.visibleIds.includes(cardId);

      if (isVisible && current.visibleIds.length === 1) {
        return current;
      }

      const visibleIds = isVisible
        ? current.visibleIds.filter((id) => id !== cardId)
        : [...current.visibleIds, cardId];
      const expandedIds = current.expandedIds.filter((id) => visibleIds.includes(id));

      return { visibleIds, expandedIds };
    });
  }

  function toggleExpanded(cardId: string) {
    updateTenantState((current) => {
      const expandedIds = current.expandedIds.includes(cardId)
        ? current.expandedIds.filter((id) => id !== cardId)
        : [...current.expandedIds, cardId];

      return { ...current, expandedIds };
    });
  }

  function showAll() {
    updateTenantState(() => ({ visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [] }));
  }

  function showExecutiveStarter() {
    updateTenantState(() => ({
      visibleIds: [
        "revenue-trend",
        "budget-vs-actual",
        "working-capital",
        "cash-collection-forecast",
        "budget-overrun-risk",
        "data-freshness",
      ],
      expandedIds: ["revenue-trend", "working-capital"],
    }));
  }

  const selectedTenant = TENANTS.find((tenant) => tenant.id === selectedTenantId) ?? TENANTS[0];

  return (
    <div className="space-y-6">
      <section className={cn("grid gap-6", isSelectorOpen ? "xl:grid-cols-[0.9fr_2.1fr]" : "grid-cols-1")}>
        {isSelectorOpen ? (
          <Card className="border-white/70 bg-white/82">
            <CardHeader className="p-5 pb-4 md:p-6 md:pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Card selector</CardTitle>
                  <CardDescription className="mt-2 leading-6">
                    Select, deselect, and curate the dashboard layout for {selectedTenant.name}.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="gold">{visibleCards.length}/20 active</Badge>
                  <button
                    type="button"
                    onClick={() => setIsSelectorOpen(false)}
                    className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition hover:text-foreground"
                    aria-label="Collapse card selector"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0 md:p-6 md:pt-0">
              {INSIGHT_OPTIONS.map((item) => {
                const selected = activeTenantState.visibleIds.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCardVisibility(item.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-3xl border px-4 py-4 text-left transition",
                      selected
                        ? "border-primary/20 bg-primary/8"
                        : "border-border/70 bg-background/75 hover:bg-background",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        selected
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-border/80 bg-muted text-muted-foreground",
                      )}
                    >
                      {selected ? "✓" : <PlusMinusIcon />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <Badge variant={getTypeBadgeVariant(item.category)}>{getTypeLabel(item.category)}</Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{selectedTenant.name}</Badge>
              <Badge variant="gold">{visibleCards.length}/20 active</Badge>
              <Badge variant="muted">{counts.prediction} predictions</Badge>
              <Badge variant="muted">{counts.anomaly} anomalies</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              {TENANTS.map((tenant) => {
                const isActive = tenant.id === selectedTenantId;

                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                      getFilterButtonTone(isActive),
                    )}
                  >
                    {tenant.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {!isSelectorOpen ? (
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/80"
                  onClick={() => setIsSelectorOpen(true)}
                >
                  <ChevronRight className="size-4" />
                  Customize cards
                </Button>
              ) : null}
              {typeFilters.length > 0 || statusFilters.length > 0 ? (
                <Button variant="outline" className="rounded-2xl bg-background/80" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Type</p>
                {(["insight", "prediction", "anomaly"] as TypeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => toggleTypeFilter(filter)}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                      getFilterButtonTone(typeFilters.includes(filter)),
                    )}
                  >
                    {getTypeLabel(filter)}
                  </button>
                ))}
                <p className="ml-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">Status</p>
                {(["On track", "Watch", "Alert"] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => toggleStatusFilter(filter)}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                      getFilterButtonTone(statusFilters.includes(filter)),
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-2xl bg-background/80" onClick={showExecutiveStarter}>
                Focused set
              </Button>
              <Button variant="outline" className="rounded-2xl bg-background/80" onClick={showAll}>
                Show all 20
              </Button>
            </div>
          </div>

          {visibleCards.length === 0 ? (
            <Card className="border-white/70 bg-white/82">
              <CardContent className="p-8">
                <p className="text-lg font-semibold">No cards match the current filters.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Clear the filters or change the selected card set to show more modules.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid auto-rows-[minmax(250px,_auto)] gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((item) => {
              const Icon = item.icon;
              const expanded = activeTenantState.expandedIds.includes(item.id);

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "flex h-full flex-col overflow-hidden border-white/70 bg-white/82 transition",
                    getCardSpan(item.size, expanded),
                  )}
                >
                  <CardHeader className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={getTypeBadgeVariant(item.category)}>{getTypeLabel(item.category)}</Badge>
                        <div className={cn("rounded-full border px-3 py-1 text-xs font-medium", getStatusTone(item.status))}>
                          {item.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCardVisibility(item.id)}
                          className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition hover:text-foreground"
                          aria-label={`Hide ${item.title}`}
                        >
                          <EyeOff className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition hover:text-foreground"
                          aria-label={expanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
                        >
                          {expanded ? <X className="size-4" /> : <Expand className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        <div className="mt-4 flex items-end gap-3">
                          <p className="text-3xl font-semibold tracking-tight">{item.metric}</p>
                          <p className={cn("pb-1 text-sm font-medium", getDeltaTone(item.deltaDirection))}>
                            {item.delta}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                        <Icon className="size-5 text-primary" />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="mt-auto space-y-4 p-6 pt-0">
                    <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{item.value}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Range over recent periods</p>
                        </div>
                        <p className="max-w-[14rem] text-right text-xs leading-5 text-muted-foreground">{item.summary}</p>
                      </div>
                      <div className="mt-4">
                        <Sparkline values={item.trend} category={item.category} status={item.status} />
                      </div>
                    </div>

                    {item.segments?.length ? (
                      <div className="rounded-3xl border border-border/70 bg-background/55 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Composition</p>
                          <p className="text-xs text-muted-foreground">{item.metric}</p>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-[132px_1fr] md:items-center">
                          <RadialBreakdown segments={item.segments} />
                          <div className="grid gap-2">
                          {item.segments.map((segment, index) => (
                            <div
                              key={segment.label}
                              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-xs text-muted-foreground"
                            >
                              <span className="flex items-center gap-2">
                                <span className={cn("size-2.5 rounded-full", segment.tone ?? getSegmentTone(index))} />
                                <span>{segment.label}</span>
                              </span>
                              <span className="font-semibold" style={{ color: getSegmentColor(index) }}>
                                {segment.value}%
                              </span>
                            </div>
                          ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {expanded ? (
                      <div className="rounded-3xl border border-dashed border-border/70 bg-background/55 p-4">
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">What this means</p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{item.detail}</p>
                      </div>
                    ) : null}

                    {expanded ? (
                      <div className="rounded-3xl border border-dashed border-border/70 bg-background/55 p-4">
                        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Warehouse inputs</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.dataSources.map((source) => (
                            <span
                              key={source}
                              className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2">
                      {item.trend.slice(-3).map((value, index) => (
                        <div key={`${item.id}-${index}`} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">P-{2 - index}</p>
                          <p className="mt-2 text-sm font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" className="w-full rounded-2xl bg-background/80">
                      {item.actionLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Sparkline({
  values,
  category,
  status,
}: {
  values: number[];
  category: InsightType;
  status: InsightOption["status"];
}) {
  const sparkId = useId();
  const points = buildSparklineCoordinates(values);
  const linePath = buildSparklinePath(points);
  const areaPath = buildAreaPath(points);
  const tone = getChartTone(category, status);
  const summary = summarizeTrend(values);
  const lastPoint = points.at(-1);
  const peakPoint = points[values.indexOf(summary.max)];
  const labels = getPeriodLabels(values.length);

  return (
    <div className={cn("rounded-[1.5rem] border border-border/70 bg-gradient-to-b from-white via-white to-background/70 p-3", tone.glow)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Current</p>
          <p className="mt-1 text-base font-semibold">{summary.current}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Step change</p>
          <p
            className={cn(
              "mt-1 text-xs font-semibold",
              summary.delta > 0 ? "text-emerald-600 dark:text-emerald-300" : summary.delta < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {getDeltaPrefix(summary.delta)}
            {summary.delta}
          </p>
        </div>
      </div>

      <svg viewBox="0 0 100 52" className="mt-3 h-24 w-full overflow-visible" style={{ color: tone.color }}>
        <defs>
          <linearGradient id={`${sparkId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="70%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <filter id={`${sparkId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[10, 22, 34].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeDasharray="2.5 3.5"
          />
        ))}

        <path d={areaPath} fill={`url(#${sparkId}-fill)`} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${sparkId}-glow)`}
        />

        {peakPoint ? (
          <>
            <circle cx={peakPoint.x} cy={peakPoint.y} r="4.5" fill="white" stroke="currentColor" strokeWidth="1.6" />
            <circle cx={peakPoint.x} cy={peakPoint.y} r="1.8" fill="currentColor" />
          </>
        ) : null}

        {lastPoint ? (
          <>
            <circle cx={lastPoint.x} cy={lastPoint.y} r="5.5" fill="currentColor" fillOpacity="0.12" />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="2.6" fill="currentColor" stroke="white" strokeWidth="1.5" />
          </>
        ) : null}

        <line x1="0" y1="44" x2="100" y2="44" stroke="currentColor" strokeOpacity="0.12" />
      </svg>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        {labels.map((label, index) => (
          <span key={`${sparkId}-${label}-${index}`} className={cn(index === labels.length - 1 && "font-medium text-foreground")}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RadialBreakdown({
  segments,
}: {
  segments: { label: string; value: number; tone: string }[];
}) {
  const size = 132;
  const center = size / 2;
  const baseRadius = 46;
  const ringGap = 12;
  const strokeWidth = 7;

  return (
    <div className="flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-[132px]">
        {segments.map((segment, index) => {
          const radius = baseRadius - index * ringGap;
          const circumference = 2 * Math.PI * radius;
          const dash = (segment.value / 100) * circumference;

          return (
            <g key={segment.label} transform={`rotate(-90 ${center} ${center})`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
                opacity="0.35"
              />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={getSegmentColor(index)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
              />
            </g>
          );
        })}
        <circle cx={center} cy={center} r="20" fill="white" />
        <text x={center} y={center - 2} textAnchor="middle" className="fill-foreground text-[16px] font-semibold">
          {segments[0]?.value ?? 0}%
        </text>
        <text x={center} y={center + 14} textAnchor="middle" className="fill-muted-foreground text-[8px] uppercase tracking-[0.16em]">
          Top share
        </text>
      </svg>
    </div>
  );
}

function PlusMinusIcon() {
  return (
    <span className="flex items-center justify-center">
      <Plus className="size-3.5" />
    </span>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <span className={cn("relative block size-3.5", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current" />
    </span>
  );
}
