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
  Gauge,
  GripVertical,
  Landmark,
  LayoutGrid,
  LineChart,
  RefreshCcw,
  ReceiptText,
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
import type { BackendFinanceInsightCard } from "@/lib/backend";
import { cn } from "@/lib/utils";

type InsightType = "insight" | "prediction" | "anomaly";
type CardSize = "sm" | "lg";

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
  runId?: string | null;
  computedAt?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
  confidence?: number | null;
  explanation?: string | null;
  evidence?: Record<string, unknown> | null;
};

type TenantOption = {
  id: string;
  name: string;
  subtitle: string;
};

type TenantState = {
  visibleIds: string[];
  expandedIds: string[];
  sizeById: Partial<Record<string, CardSize>>;
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    size: "sm",
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
    id: "liquidity-gap-forecast",
    title: "Liquidity gap forecast",
    category: "prediction",
    summary: "Forecasts whether expected cash-in, cash-out, and bank balances create a short-term liquidity gap.",
    detail: "This is the most actionable cash forecast because it translates invoice timing into a funding or payment decision.",
    dataSources: ["fact_open_item_snapshot", "fact_sales_invoice", "fact_purchase_invoice", "dim_ledger_account"],
    value: "Cash risk",
    actionLabel: "Plan cash gap",
    size: "lg",
    metric: "€220k",
    delta: "Week 3 gap risk",
    deltaDirection: "down",
    status: "Alert",
    trend: [72, 66, 61, 55, 48, 39, 32],
    segments: [
      { label: "Expected in", value: 44, tone: "bg-chart-2" },
      { label: "Expected out", value: 51, tone: "bg-chart-5" },
      { label: "Buffer", value: 5, tone: "bg-chart-4" },
    ],
    icon: Landmark,
  },
  {
    id: "credit-limit-breach-risk",
    title: "Customer credit limit breach risk",
    category: "prediction",
    summary: "Predicts customers likely to exceed credit limits or payment-term tolerance based on open AR and invoice behavior.",
    detail: "This gives sales and credit control a concrete intervention point before more exposure is added.",
    dataSources: ["dim_counterparty", "fact_open_item_snapshot", "fact_sales_invoice"],
    value: "Credit",
    actionLabel: "Review credit holds",
    size: "sm",
    metric: "6 customers",
    delta: "At breach risk",
    deltaDirection: "down",
    status: "Alert",
    trend: [2, 3, 3, 4, 4, 5, 6],
    icon: ShieldAlert,
  },
  {
    id: "expected-bad-debt-risk",
    title: "Expected bad debt risk",
    category: "prediction",
    summary: "Estimates receivables at elevated non-collection risk using aging, amount, and customer payment behavior.",
    detail: "Useful for deciding which balances need escalation, provisions, or legal review before the next close.",
    dataSources: ["fact_open_item_snapshot", "fact_sales_invoice", "dim_counterparty"],
    value: "Loss risk",
    actionLabel: "Escalate collections",
    size: "sm",
    metric: "€84k",
    delta: "Elevated risk",
    deltaDirection: "down",
    status: "Watch",
    trend: [42, 45, 47, 50, 54, 57, 61],
    icon: CreditCard,
  },
  {
    id: "supplier-payment-priority",
    title: "Supplier payment priority forecast",
    category: "prediction",
    summary: "Ranks which supplier payments should be protected using due dates, overdue pressure, and supplier concentration.",
    detail: "Turns AP forecasting into a payment run decision instead of only showing upcoming cash-out.",
    dataSources: ["fact_open_item_snapshot", "fact_purchase_invoice", "dim_counterparty"],
    value: "Payment run",
    actionLabel: "Prioritize suppliers",
    size: "sm",
    metric: "9 payments",
    delta: "Protect this week",
    deltaDirection: "flat",
    status: "Watch",
    trend: [5, 5, 6, 6, 7, 8, 9],
    icon: BanknoteArrowDown,
  },
  {
    id: "budget-exhaustion-date",
    title: "Budget exhaustion date",
    category: "prediction",
    summary: "Forecasts when a team, account, or cost center will exhaust budget at the current spend pace.",
    detail: "More actionable than variance alone because it gives finance a date for intervention or reallocation.",
    dataSources: ["fact_budget", "fact_journal_entry_line", "dim_org_unit", "dim_ledger_account"],
    value: "Runway",
    actionLabel: "Move or pause spend",
    size: "sm",
    metric: "May 18",
    delta: "Earliest exhaustion",
    deltaDirection: "down",
    status: "Alert",
    trend: [74, 68, 61, 54, 46, 38, 31],
    icon: Gauge,
  },
  {
    id: "month-end-close-variance",
    title: "Month-end close variance forecast",
    category: "prediction",
    summary: "Predicts close-position variance before period end from posting cadence, run-rate, budget, and late entries.",
    detail: "Helps controllers challenge likely misses while there is still time to correct coding or spending.",
    dataSources: ["fact_budget", "fact_journal_entry_line", "dim_date", "dim_org_unit"],
    value: "Close risk",
    actionLabel: "Pre-close review",
    size: "sm",
    metric: "€173k",
    delta: "Projected miss",
    deltaDirection: "down",
    status: "Watch",
    trend: [28, 34, 41, 49, 56, 64, 71],
    icon: ReceiptText,
  },
  {
    id: "margin-compression-warning",
    title: "Margin compression early warning",
    category: "prediction",
    summary: "Forecasts margin pressure where revenue growth is being outpaced by direct cost movement.",
    detail: "Gives leadership a pricing, delivery cost, or supplier negotiation signal before the P&L fully deteriorates.",
    dataSources: ["fact_journal_entry_line", "dim_ledger_account", "dim_org_unit"],
    value: "Margin risk",
    actionLabel: "Review cost drivers",
    size: "sm",
    metric: "-2.1 pts",
    delta: "Projected next period",
    deltaDirection: "down",
    status: "Watch",
    trend: [58, 56, 53, 51, 49, 46, 44],
    icon: TrendingDown,
  },
  {
    id: "tax-exposure-forecast",
    title: "Tax exposure forecast",
    category: "prediction",
    summary: "Projects VAT or tax payable movement from tax codes, recoverability, and posting patterns.",
    detail: "Useful before filing periods because it can catch cash surprises and tax-code drift early.",
    dataSources: ["fact_journal_entry_line", "dim_tax_code", "dim_date"],
    value: "Tax cash",
    actionLabel: "Review tax exposure",
    size: "sm",
    metric: "€96k",
    delta: "Next filing",
    deltaDirection: "flat",
    status: "On track",
    trend: [36, 38, 41, 43, 44, 46, 47],
    icon: CircleDollarSign,
  },
  {
    id: "connector-impact-forecast",
    title: "Connector impact forecast",
    category: "prediction",
    summary: "Forecasts which business metrics will lose confidence if a stale source is not refreshed.",
    detail: "This makes data freshness actionable by linking failed or delayed syncs to affected cash, AP, AR, and P&L numbers.",
    dataSources: ["sync_run", "sync_cursor", "raw_object", "mart.v_data_freshness"],
    value: "Confidence",
    actionLabel: "Fix impacted feeds",
    size: "lg",
    metric: "€481k",
    delta: "AP confidence at risk",
    deltaDirection: "down",
    status: "Alert",
    trend: [88, 84, 79, 72, 66, 58, 49],
    icon: RefreshCcw,
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
    size: "sm",
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
    size: "sm",
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
const DEFAULT_SIZE_BY_ID: Partial<Record<string, CardSize>> = {};
const CARD_SIZE_OPTIONS: CardSize[] = ["sm", "lg"];

function getStorageKey(tenantId: string) {
  return `solon-insights-layout:${tenantId}`;
}

function normalizeCardSize(value: unknown): CardSize | null {
  if (value === "sm" || value === "lg") {
    return value;
  }

  if (value === "md") {
    return "sm";
  }

  return null;
}

function getDefaultTenantState(): TenantState {
  return { visibleIds: DEFAULT_VISIBLE_IDS, expandedIds: [], sizeById: DEFAULT_SIZE_BY_ID };
}

function normalizeTenantState(value?: Partial<TenantState>): TenantState {
  const visibleIds = Array.isArray(value?.visibleIds)
    ? value.visibleIds.filter((id) => DEFAULT_VISIBLE_IDS.includes(id))
    : DEFAULT_VISIBLE_IDS;
  const dedupedVisibleIds = Array.from(new Set(visibleIds));
  const sizeEntries = Object.entries(value?.sizeById ?? {}).flatMap(([id, size]) => {
    if (!DEFAULT_VISIBLE_IDS.includes(id)) {
      return [];
    }

    const normalizedSize = normalizeCardSize(size);
    return normalizedSize ? ([[id, normalizedSize]] as [string, CardSize][]) : [];
  });

  return {
    visibleIds: dedupedVisibleIds.length > 0 ? dedupedVisibleIds : DEFAULT_VISIBLE_IDS,
    expandedIds: Array.isArray(value?.expandedIds)
      ? value.expandedIds.filter((id) => dedupedVisibleIds.includes(id))
      : [],
    sizeById: Object.fromEntries(sizeEntries),
  };
}

function getInitialTenantState(): Record<string, TenantState> {
  if (typeof window === "undefined") {
    return Object.fromEntries(TENANTS.map((tenant) => [tenant.id, getDefaultTenantState()]));
  }

  return Object.fromEntries(
    TENANTS.map((tenant) => {
      const storedValue = window.localStorage.getItem(getStorageKey(tenant.id));

      if (!storedValue) {
        return [tenant.id, getDefaultTenantState()];
      }

      try {
        const parsed = JSON.parse(storedValue) as Partial<TenantState>;
        return [tenant.id, normalizeTenantState(parsed)];
      } catch {
        return [tenant.id, getDefaultTenantState()];
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

function getCardSpan(size: CardSize) {
  if (size === "lg") {
    return "md:col-span-2 xl:col-span-2";
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

export function InsightsDashboard({ cards = [] }: { cards?: BackendFinanceInsightCard[] }) {
  const [selectedTenantId, setSelectedTenantId] = useState(TENANTS[0].id);
  const [tenantState, setTenantState] = useState<Record<string, TenantState>>(getInitialTenantState);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [typeFilters, setTypeFilters] = useState<TypeFilter[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  useEffect(() => {
    for (const [tenantId, state] of Object.entries(tenantState)) {
      window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(state));
    }
  }, [tenantState]);

  useEffect(() => {
    if (!selectedInsightId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedInsightId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedInsightId]);

  const activeTenantState = tenantState[selectedTenantId] ?? {
    visibleIds: DEFAULT_VISIBLE_IDS,
    expandedIds: [],
    sizeById: DEFAULT_SIZE_BY_ID,
  };

  const insightOptions = useMemo(() => {
    const overridesById = new Map(cards.map((item) => [item.id, item]));

    return INSIGHT_OPTIONS.map((item) => {
      const override = overridesById.get(item.id);

      if (!override) {
        return item;
      }

      return {
        ...item,
        metric: override.metric,
        delta: override.delta,
        deltaDirection: override.deltaDirection,
        status: override.status,
        trend: override.trend,
        segments: override.segments ?? item.segments,
        runId: override.runId,
        computedAt: override.computedAt,
        modelName: override.modelName,
        modelVersion: override.modelVersion,
        confidence: override.confidence,
        explanation: override.explanation,
        evidence: override.evidence,
      };
    });
  }, [cards]);

  const configuredCards = useMemo(() => {
    const cardsById = new Map(insightOptions.map((item) => [item.id, item]));

    return activeTenantState.visibleIds
      .map((id) => cardsById.get(id))
      .filter((item): item is InsightOption => Boolean(item))
      .map((item) => ({
        ...item,
        size: activeTenantState.sizeById[item.id] ?? item.size,
      }));
  }, [activeTenantState.sizeById, activeTenantState.visibleIds, insightOptions]);

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

  const selectedInsight = useMemo(() => {
    if (!selectedInsightId) {
      return null;
    }

    return configuredCards.find((item) => item.id === selectedInsightId) ?? null;
  }, [configuredCards, selectedInsightId]);

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
        const existing = current[selectedTenantId] ?? getDefaultTenantState();

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

      return { ...current, visibleIds, expandedIds };
    });
  }

  function moveCardTo(sourceCardId: string, targetCardId: string) {
    updateTenantState((current) => {
      if (sourceCardId === targetCardId) {
        return current;
      }

      const sourceIndex = current.visibleIds.indexOf(sourceCardId);
      const targetIndex = current.visibleIds.indexOf(targetCardId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const visibleIds = [...current.visibleIds];
      const [card] = visibleIds.splice(sourceIndex, 1);
      visibleIds.splice(targetIndex, 0, card);

      return { ...current, visibleIds };
    });
  }

  function updateCardSize(cardId: string, size: CardSize) {
    updateTenantState((current) => ({
      ...current,
      sizeById: {
        ...current.sizeById,
        [cardId]: size,
      },
    }));
  }

  function showAll() {
    updateTenantState(() => getDefaultTenantState());
  }

  function showExecutiveStarter() {
    updateTenantState(() => ({
      visibleIds: [
        "revenue-trend",
        "budget-vs-actual",
        "working-capital",
        "cash-collection-forecast",
        "liquidity-gap-forecast",
        "budget-overrun-risk",
        "budget-exhaustion-date",
        "data-freshness",
      ],
      expandedIds: [],
      sizeById: {
        "revenue-trend": "lg",
        "liquidity-gap-forecast": "lg",
        "budget-exhaustion-date": "sm",
      },
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
                  <Badge variant="gold">
                    {visibleCards.length}/{insightOptions.length} active
                  </Badge>
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
              {insightOptions.map((item) => {
                const selected = activeTenantState.visibleIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-3xl border px-4 py-4 transition",
                      selected
                        ? "border-primary/20 bg-primary/8"
                        : "border-border/70 bg-background/75 hover:bg-background",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCardVisibility(item.id)}
                        className={cn(
                          "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                          selected
                            ? "border-primary/20 bg-primary text-primary-foreground"
                            : "border-border/80 bg-muted text-muted-foreground hover:text-foreground",
                        )}
                        aria-label={selected ? `Hide ${item.title}` : `Show ${item.title}`}
                      >
                        {selected ? "✓" : <PlusMinusIcon />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <Badge variant={getTypeBadgeVariant(item.category)}>{getTypeLabel(item.category)}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{selectedTenant.name}</Badge>
              <Badge variant="gold">
                {visibleCards.length}/{insightOptions.length} active
              </Badge>
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
                Show all {insightOptions.length}
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

          <div className="grid auto-rows-[minmax(210px,_auto)] gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggingCardId && draggingCardId !== item.id) {
                      setDropTargetCardId(item.id);
                    }
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDropTargetCardId((current) => (current === item.id ? null : current));
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceCardId = event.dataTransfer.getData("text/plain") || draggingCardId;

                    if (sourceCardId) {
                      moveCardTo(sourceCardId, item.id);
                    }

                    setDraggingCardId(null);
                    setDropTargetCardId(null);
                  }}
                  className={cn(
                    "group relative flex h-full flex-col overflow-hidden border-white/70 bg-white/82 transition-all duration-200 ease-out",
                    draggingCardId === item.id ? "opacity-55" : null,
                    dropTargetCardId === item.id ? "ring-2 ring-primary/35" : null,
                    getCardSpan(item.size),
                  )}
                >
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", item.id);
                            setDraggingCardId(item.id);
                          }}
                          onDragEnd={() => {
                            setDraggingCardId(null);
                            setDropTargetCardId(null);
                          }}
                          className="mt-0.5 cursor-grab rounded-full border border-border/60 bg-background/65 p-1.5 text-muted-foreground opacity-50 transition active:cursor-grabbing group-hover:opacity-100 hover:text-foreground"
                          aria-label={`Drag ${item.title}`}
                        >
                          <GripVertical className="size-3.5" />
                        </button>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/65">
                              <Icon className="size-3.5 text-primary" />
                            </span>
                            <CardTitle className="truncate text-base">{item.title}</CardTitle>
                          </div>
                          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{getTypeLabel(item.category)}</span>
                            <span className="text-border">/</span>
                            <span>{item.value}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 opacity-55 transition group-hover:opacity-100">
                        <CardSizeControl
                          value={item.size}
                          onChange={(size) => updateCardSize(item.id, size)}
                          label={`Set size for ${item.title}`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleCardVisibility(item.id)}
                          className="rounded-full border border-border/60 bg-background/65 p-1.5 text-muted-foreground transition hover:text-foreground"
                          aria-label={`Hide ${item.title}`}
                        >
                          <EyeOff className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedInsightId(item.id)}
                          className="rounded-full border border-border/60 bg-background/65 p-1.5 text-muted-foreground transition hover:text-foreground"
                          aria-label={`Open details for ${item.title}`}
                        >
                          <Expand className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="mt-auto space-y-4 p-5 pt-0">
                    <div className="flex items-end justify-between gap-4 border-t border-border/60 pt-4">
                      <div className="min-w-0">
                        <p className="text-2xl font-semibold tracking-tight">{item.metric}</p>
                        <p className={cn("mt-1 truncate text-sm font-medium", getDeltaTone(item.deltaDirection))}>{item.delta}</p>
                      </div>
                      <div className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", getStatusTone(item.status))}>
                        {item.status}
                      </div>
                    </div>

                    <div className="h-[76px] overflow-hidden rounded-xl border border-border/60 bg-background/45">
                      <Sparkline values={item.trend} category={item.category} status={item.status} />
                    </div>

                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      {selectedInsight ? (
        <InsightDetailModal item={selectedInsight} onClose={() => setSelectedInsightId(null)} />
      ) : null}
    </div>
  );
}

function Sparkline({
  values,
  category,
  status,
  className,
}: {
  values: number[];
  category: InsightType;
  status: InsightOption["status"];
  className?: string;
}) {
  const sparkId = useId();
  const points = buildSparklineCoordinates(values);
  const linePath = buildSparklinePath(points);
  const areaPath = buildAreaPath(points);
  const tone = getChartTone(category, status);

  return (
    <div className={cn("relative h-[76px] bg-gradient-to-b from-white/75 via-white/35 to-background/45", tone.glow, className)}>
      <svg viewBox="0 0 100 52" className="absolute inset-x-0 bottom-0 h-full w-full overflow-visible" style={{ color: tone.color }}>
        <defs>
          <linearGradient id={`${sparkId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="72%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <filter id={`${sparkId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={areaPath} fill={`url(#${sparkId}-fill)`} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${sparkId}-glow)`}
        />
      </svg>
    </div>
  );
}

function CardSizeControl({
  value,
  onChange,
  label,
}: {
  value: CardSize;
  onChange: (size: CardSize) => void;
  label: string;
}) {
  return (
    <div
      className="flex items-center rounded-full border border-border/60 bg-background/65 p-0.5"
      role="group"
      aria-label={label}
    >
      {CARD_SIZE_OPTIONS.map((size) => {
        const active = size === value;

        return (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            className={cn(
              "flex size-[18px] items-center justify-center rounded-full text-muted-foreground transition",
              active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-background hover:text-foreground",
            )}
            aria-label={`Set ${getCardSizeLabel(size)} size`}
            aria-pressed={active}
            title={getCardSizeLabel(size)}
          >
            <SizeGlyph size={size} />
          </button>
        );
      })}
    </div>
  );
}

function getCardSizeLabel(size: CardSize) {
  if (size === "sm") return "Compact";
  return "Wide";
}

function SizeGlyph({ size }: { size: CardSize }) {
  const activeBlocks = size === "sm" ? 1 : 3;

  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            "block w-[3px] rounded-[1px] bg-current transition-opacity",
            index === 0 ? "h-[5px]" : index === 1 ? "h-2" : "h-3",
            index < activeBlocks ? "opacity-100" : "opacity-25",
          )}
        />
      ))}
    </span>
  );
}

function InsightDetailModal({ item, onClose }: { item: InsightOption; onClose: () => void }) {
  const Icon = item.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`insight-detail-${item.id}`}
      onMouseDown={onClose}
    >
      <Card
        className="w-full max-w-4xl overflow-hidden border-white/75 bg-white/95 shadow-[0_28px_120px_rgba(11,18,32,0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CardHeader className="border-b border-border/70 p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80">
                  <Icon className="size-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <CardTitle id={`insight-detail-${item.id}`} className="truncate text-xl">
                    {item.title}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{getTypeLabel(item.category)}</span>
                    <span className="text-border">/</span>
                    <span>{item.value}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition hover:text-foreground"
              aria-label="Close insight details"
            >
              <X className="size-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/55">
              <Sparkline values={item.trend} category={item.category} status={item.status} className="h-[132px]" />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
              <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Current</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{item.metric}</p>
              <p className={cn("mt-2 text-sm font-medium", getDeltaTone(item.deltaDirection))}>{item.delta}</p>
              <div className={cn("mt-4 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", getStatusTone(item.status))}>
                {item.status}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 p-4">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">What this means</p>
            <p className="mt-2 text-sm leading-6 text-foreground">{item.explanation ?? item.detail}</p>
          </div>

          {item.segments?.length ? <SegmentBreakdown item={item} /> : null}

          {hasAnalyticsEvidence(item) ? <AnalystEvidenceCard item={item} /> : null}

          <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 p-4">
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

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-2xl bg-background/80">
              {item.actionLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentBreakdown({ item }: { item: InsightOption }) {
  if (!item.segments?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
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
  );
}

function hasAnalyticsEvidence(item: InsightOption) {
  return Boolean(
    item.confidence ||
      item.computedAt ||
      item.modelName ||
      item.evidence?.analyst_logic ||
      getEvidenceTables(item.evidence).length,
  );
}

function AnalystEvidenceCard({ item }: { item: InsightOption }) {
  const evidenceTables = getEvidenceTables(item.evidence);

  return (
    <div className="rounded-3xl border border-border/70 bg-background/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Analyst evidence</p>
          {typeof item.evidence?.analyst_logic === "string" ? (
            <p className="mt-2 text-sm leading-6 text-foreground">{item.evidence.analyst_logic}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {item.confidence ? <Badge variant="muted">{Math.round(item.confidence * 100)}% confidence</Badge> : null}
          {item.modelVersion ? <Badge variant="muted">{item.modelVersion}</Badge> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {item.modelName ? <EvidenceStat label="Model" value={formatModelName(item.modelName)} /> : null}
        {item.computedAt ? <EvidenceStat label="Computed" value={formatDateTime(item.computedAt)} /> : null}
        {item.runId ? <EvidenceStat label="Run" value={item.runId.slice(0, 8)} /> : null}
      </div>

      {evidenceTables.length ? (
        <div className="mt-4 space-y-4">
          {evidenceTables.map((table) => (
            <EvidenceTable key={table.label} label={table.label} rows={table.rows} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
      <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function EvidenceTable({ label, rows }: { label: string; rows: Record<string, unknown>[] }) {
  const columns = getEvidenceColumns(rows);

  if (!rows.length || !columns.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">No exceptions found in the latest analytics run.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {formatColumnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border/60">
                {columns.map((column) => (
                  <td key={column} className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                    {formatEvidenceValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getEvidenceTables(evidence?: Record<string, unknown> | null) {
  if (!evidence) return [];

  return [
    { label: "Top revenue drivers", rows: evidence.top_drivers },
    { label: "Cost drivers", rows: evidence.top_cost_drivers },
    { label: "Top budget variances", rows: evidence.top_variances },
    { label: "Customer aging", rows: evidence.customer_aging },
    { label: "Duplicate matches", rows: evidence.matches },
    { label: "Journal outliers", rows: evidence.outliers },
  ].flatMap((table) => {
    if (!Array.isArray(table.rows)) return [];
    return [{ label: table.label, rows: table.rows.filter(isEvidenceRow) }];
  });
}

function isEvidenceRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getEvidenceColumns(rows: Record<string, unknown>[]) {
  const preferred = [
    "account_code",
    "account_name",
    "org_unit_name",
    "counterparty_name",
    "source",
    "invoice_date",
    "posting_date",
    "amount_base",
    "amount_incl_tax_base",
    "budget_amount_base",
    "actual_amount_base",
    "variance_amount_base",
    "actual_vs_budget_pct",
    "total_open_amount_base",
    "current_amount",
    "overdue_1_30",
    "overdue_31_60",
    "overdue_61_90",
    "overdue_90_plus",
    "match_count",
    "document_numbers",
    "z_score",
  ];
  const available = new Set(rows.flatMap((row) => Object.keys(row)));
  const ordered = preferred.filter((key) => available.has(key));
  const remaining = [...available].filter((key) => !ordered.includes(key)).sort();
  return [...ordered, ...remaining].slice(0, 6);
}

function formatColumnLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatEvidenceValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatModelName(value: string) {
  return value.replaceAll("_", " ");
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
