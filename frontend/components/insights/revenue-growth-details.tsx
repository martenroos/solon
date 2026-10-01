import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  formatMoneyValue,
  formatPercentValue,
  formatShortMoney,
  getEvidenceNumber,
  getEvidenceRows,
} from "@/components/insights/evidence-utils";
import { EvidenceStat, EvidenceTable } from "@/components/insights/evidence-panel";
import type { InsightOption } from "@/components/insights/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function RevenueGrowthDetails({ item }: { item: InsightOption }) {
  const bridgeRows = getEvidenceRows(item.evidence, "driver_bridge");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const customers = useMemo(
    () =>
      Array.from(
        new Set(
          bridgeRows
            .map((row) => (typeof row.customer_name === "string" ? row.customer_name : null))
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [bridgeRows],
  );
  const rows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return bridgeRows.filter((row) => {
      const customer = String(row.customer_name ?? "");
      const searchableText = [
        row.customer_name,
        row.org_unit_name,
        row.account_code,
        row.account_name,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return (
        (customerFilter === "all" || customer === customerFilter) &&
        (!search || searchableText.includes(search))
      );
    });
  }, [bridgeRows, customerFilter, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/70 bg-background/55 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Revenue growth breakdown
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Current-period growth is compared against both the previous fiscal period and the
              same fiscal period last year.
            </p>
          </div>
          <Badge variant={item.status === "Watch" ? "gold" : item.status === "On track" ? "default" : "muted"}>
            {item.status}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <EvidenceStat label="Current revenue" value={formatMoneyValue(getEvidenceNumber(item.evidence, "current_revenue"))} />
          <EvidenceStat label="Previous period" value={formatMoneyValue(getEvidenceNumber(item.evidence, "previous_revenue"))} />
          <EvidenceStat label="Same period LY" value={formatMoneyValue(getEvidenceNumber(item.evidence, "year_ago_revenue"))} />
          <EvidenceStat label="MoM growth" value={formatPercentValue(getEvidenceNumber(item.evidence, "mom_growth_pct"))} />
          <EvidenceStat label="YoY growth" value={formatPercentValue(getEvidenceNumber(item.evidence, "yoy_growth_pct"))} />
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-background/55 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Driver bridge</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Current versus previous revenue by customer, org unit, and account.
            </p>
          </div>
          <Badge variant="muted">
            {rows.length}/{bridgeRows.length} rows
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[240px_1fr]">
          <label className="grid gap-2 text-xs font-medium text-muted-foreground">
            Customer
            <select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              className={[
                "h-12 rounded-2xl border border-border/80 bg-background/80 px-4 py-3",
                "text-sm text-foreground shadow-sm outline-none transition",
                "focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10",
              ].join(" ")}
            >
              <option value="all">All customers</option>
              {customers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-medium text-muted-foreground">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search customer, org unit, account"
                className="pl-10"
              />
            </span>
          </label>
        </div>
        <div className="mt-4">
          <EvidenceTable label="Revenue growth bridge" rows={rows} />
        </div>
      </div>
    </div>
  );
}

export function RevenueGrowthChart({ item }: { item: InsightOption }) {
  const gradientId = useId();
  const values = item.trend.length ? item.trend : [0];
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 0.01);
  const points = values.map((value, index) => ({
    x: 22 + (index * 116) / Math.max(values.length - 1, 1),
    y: 86 - ((value - min) / range) * 54,
  }));
  const linePath = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? 138} 94 L ${points[0]?.x ?? 22} 94 Z`;
  const comparison = [
    { label: "Prev", value: getEvidenceNumber(item.evidence, "previous_revenue"), color: "var(--muted-foreground)", opacity: 0.35 },
    { label: "Current", value: getEvidenceNumber(item.evidence, "current_revenue"), color: "var(--color-chart-2)", opacity: 1 },
    { label: "LY", value: getEvidenceNumber(item.evidence, "year_ago_revenue"), color: "var(--muted-foreground)", opacity: 0.55 },
  ];
  const maxComparison = Math.max(...comparison.map((bar) => bar.value ?? 0), 1);

  return (
    <div className="grid min-h-[132px] gap-4 bg-gradient-to-b from-white/80 to-background/45 p-4 md:grid-cols-[1fr_190px]">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">6-period revenue trend</p>
          <p className="text-xs font-medium text-muted-foreground">{formatShortMoney(comparison[1].value)}</p>
        </div>
        <svg viewBox="0 0 160 108" className="mt-2 h-[92px] w-full overflow-visible" aria-label="Revenue trend chart">
          <defs>
            <linearGradient id={`${gradientId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[32, 59, 86].map((y) => (
            <line key={y} x1="18" x2="142" y1={y} y2={y} stroke="hsl(var(--border))" />
          ))}
          <path d={areaPath} fill={`url(#${gradientId}-fill)`} />
          <path d={linePath} fill="none" stroke="var(--color-chart-2)" strokeWidth="3" strokeLinecap="round" />
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={3.6} fill="white" stroke="var(--color-chart-2)" strokeWidth="2.4" />
          ))}
        </svg>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Period compare</p>
        <div className="mt-3 grid gap-2">
          {comparison.map((bar) => (
            <div key={bar.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground">{bar.label}</span>
                <span className="text-muted-foreground">{formatShortMoney(bar.value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(((bar.value ?? 0) / maxComparison) * 100, bar.value ? 8 : 0)}%`,
                    backgroundColor: bar.color,
                    opacity: bar.opacity,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
