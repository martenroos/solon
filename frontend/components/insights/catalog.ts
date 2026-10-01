import {
  AlertTriangle, ArrowDownUp, BanknoteArrowDown, BanknoteArrowUp, BriefcaseBusiness,
  CircleDollarSign, Combine, CreditCard, Diff, Gauge, Landmark, LayoutGrid, LineChart,
  ReceiptText, RefreshCcw, ScanSearch, ShieldAlert, ShoppingCart, TrendingDown, TrendingUp,
  Users, Wallet,
} from "lucide-react";

import type { CardSize, InsightOption, InsightType, TenantOption } from "@/components/insights/types";

export const TENANTS: TenantOption[] = [
  { id: "solon-group", name: "Solon Group", subtitle: "Group dashboard" },
  { id: "north-holding", name: "North Holding", subtitle: "Tenant dashboard" },
  { id: "canal-ventures", name: "Canal Ventures", subtitle: "Tenant dashboard" },
];

type Definition = [string, string, InsightType, string, CardSize, InsightOption["icon"]];

const DEFINITIONS: Definition[] = [
  ["revenue-trend", "Revenue growth", "insight", "Compare periods", "lg", TrendingUp],
  ["gross-margin", "Gross margin % by customer", "insight", "Inspect margin mix", "sm", Diff],
  ["net-profit-margin", "Net profit margin", "insight", "Inspect profit drivers", "sm", Gauge],
  ["ebitda-trend", "EBITDA trend", "insight", "Review EBITDA trend", "sm", LineChart],
  ["opex-run-rate", "Opex run-rate", "insight", "Review departments", "sm", BriefcaseBusiness],
  ["trial-balance-movement", "Trial balance movement", "insight", "Open account movement", "sm", LayoutGrid],
  ["budget-vs-actual", "Budget vs actual variance", "insight", "Review variance", "lg", CircleDollarSign],
  ["customer-concentration", "Customer concentration risk", "insight", "View top customers", "sm", Users],
  ["supplier-concentration", "Supplier concentration risk", "insight", "View top suppliers", "sm", ShoppingCart],
  ["ar-aging", "AR aging composition", "insight", "Review receivables aging", "sm", BanknoteArrowUp],
  ["ap-aging", "AP aging composition", "insight", "Review payables aging", "sm", BanknoteArrowDown],
  ["working-capital", "Working capital trend", "insight", "Open working capital", "lg", Wallet],
  ["cash-collection-forecast", "Cash collection forecast", "prediction", "Forecast cash-in", "lg", LineChart],
  ["supplier-payment-forecast", "Supplier payment forecast", "prediction", "Forecast cash-out", "sm", ArrowDownUp],
  ["revenue-forecast", "Revenue forecast", "prediction", "Project revenue", "sm", TrendingUp],
  ["expense-forecast", "Expense forecast", "prediction", "Project spend", "sm", TrendingDown],
  ["budget-overrun-risk", "Budget overrun prediction", "prediction", "Find overrun risk", "sm", ShieldAlert],
  ["overdue-risk", "Overdue invoice risk prediction", "prediction", "Prioritize follow-up", "sm", CreditCard],
  ["liquidity-gap-forecast", "Liquidity gap forecast", "prediction", "Plan cash gap", "lg", Landmark],
  ["credit-limit-breach-risk", "Customer credit limit breach risk", "prediction", "Review credit holds", "sm", ShieldAlert],
  ["expected-bad-debt-risk", "Expected bad debt risk", "prediction", "Escalate collections", "sm", CreditCard],
  ["supplier-payment-priority", "Supplier payment priority forecast", "prediction", "Prioritize suppliers", "sm", BanknoteArrowDown],
  ["budget-exhaustion-date", "Budget exhaustion date", "prediction", "Move or pause spend", "sm", Gauge],
  ["month-end-close-variance", "Month-end close variance forecast", "prediction", "Pre-close review", "sm", ReceiptText],
  ["margin-compression-warning", "Margin compression early warning", "prediction", "Review cost drivers", "sm", TrendingDown],
  ["tax-exposure-forecast", "Tax exposure forecast", "prediction", "Review tax exposure", "sm", CircleDollarSign],
  ["connector-impact-forecast", "Connector impact forecast", "prediction", "Fix impacted feeds", "lg", RefreshCcw],
  ["abnormal-journal-amounts", "Abnormal journal amount detection", "anomaly", "Inspect outliers", "lg", AlertTriangle],
  ["duplicate-postings", "Duplicate posting detection", "anomaly", "Review duplicates", "sm", Combine],
  ["unusual-posting-combos", "Unusual posting combination detection", "anomaly", "Review unusual combinations", "sm", ScanSearch],
  ["data-freshness", "Data freshness and sync anomaly detection", "anomaly", "Check freshness", "lg", RefreshCcw],
];

function createOption([id, title, category, actionLabel, size, icon]: Definition): InsightOption {
  const kind = category === "insight" ? "financial performance" : category === "prediction" ? "forward-looking risk" : "exception";
  return {
    id, title, category, actionLabel, size, icon,
    summary: `Monitors ${kind} from the latest finance analytics run.`,
    detail: `Review the supporting warehouse evidence and calculation output for ${title.toLowerCase()}.`,
    dataSources: ["finance warehouse", "mart.insight_signal"],
    value: category === "prediction" ? "Forecast" : category === "anomaly" ? "Exception" : "Metric",
    metric: "-", delta: "Awaiting analytics", deltaDirection: "flat", status: "On track",
    trend: [0, 0, 0, 0, 0, 0, 0],
  };
}

export const INSIGHT_OPTIONS = DEFINITIONS.map(createOption);
// All known card ids: the default "show everything" visible set, and also
// the allow-list used to validate ids restored from localStorage.
export const ALL_CARD_IDS = INSIGHT_OPTIONS.map((item) => item.id);
export const REQUIRED_VISIBLE_IDS = ["net-profit-margin", "ebitda-trend"];
