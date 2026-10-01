import { getEvidenceRows, formatDateTime } from "@/components/insights/evidence-utils";
import type { InsightOption } from "@/components/insights/types";
import { Badge } from "@/components/ui/badge";

export function hasAnalyticsEvidence(item: InsightOption) {
  return Boolean(
    item.confidence ||
      item.computedAt ||
      item.modelName ||
      item.evidence?.analyst_logic ||
      getEvidenceTables(item.evidence).length,
  );
}

export function AnalystEvidenceCard({ item }: { item: InsightOption }) {
  const tables = getEvidenceTables(item.evidence);

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
          {item.confidence ? (
            <Badge variant="muted">{Math.round(item.confidence * 100)}% confidence</Badge>
          ) : null}
          {item.modelVersion ? <Badge variant="muted">{item.modelVersion}</Badge> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {item.modelName ? <EvidenceStat label="Model" value={item.modelName.replaceAll("_", " ")} /> : null}
        {item.computedAt ? <EvidenceStat label="Computed" value={formatDateTime(item.computedAt)} /> : null}
        {item.runId ? <EvidenceStat label="Run" value={item.runId.slice(0, 8)} /> : null}
      </div>
      {tables.length ? (
        <div className="mt-4 space-y-4">
          {tables.map((table) => (
            <EvidenceTable key={table.label} label={table.label} rows={table.rows} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
      <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function EvidenceTable({ label, rows }: { label: string; rows: Record<string, unknown>[] }) {
  const columns = getEvidenceColumns(rows);

  if (!rows.length || !columns.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No exceptions found in the latest analytics run.
        </p>
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
                  {column.replaceAll("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, index) => (
              <tr key={index} className="border-t border-border/60">
                {columns.map((column) => (
                  <td key={column} className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                    {formatEvidenceValue(row[column], column)}
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
  const definitions = [
    ["Top revenue drivers", "top_drivers"],
    ["Cost drivers", "top_cost_drivers"],
    ["Top budget variances", "top_variances"],
    ["Customer aging", "customer_aging"],
    ["Duplicate matches", "matches"],
    ["Journal outliers", "outliers"],
  ] as const;

  return definitions.flatMap(([label, key]) => {
    const rows = getEvidenceRows(evidence, key);
    return rows.length ? [{ label, rows }] : [];
  });
}

function getEvidenceColumns(rows: Record<string, unknown>[]) {
  const preferred = [
    "customer_name", "account_code", "account_name", "org_unit_name",
    "current_revenue", "previous_revenue", "revenue_change", "change_pct",
    "growth_contribution_pct", "counterparty_name", "source", "invoice_date",
    "posting_date", "amount_base", "amount_incl_tax_base", "budget_amount_base",
    "actual_amount_base", "variance_amount_base", "actual_vs_budget_pct",
    "total_open_amount_base", "current_amount", "overdue_1_30",
    "overdue_31_60", "overdue_61_90", "overdue_90_plus", "match_count",
    "document_numbers", "z_score",
  ];
  const available = new Set(rows.flatMap((row) => Object.keys(row)));
  const ordered = preferred.filter((key) => available.has(key));
  const remaining = [...available].filter((key) => !preferred.includes(key)).sort();
  return [...ordered, ...remaining].slice(0, 6);
}

function formatEvidenceValue(value: unknown, column?: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") {
    if (column?.includes("revenue") || column?.includes("amount")) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (column?.includes("pct")) return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
