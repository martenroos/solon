import { ChevronRight } from "lucide-react";

import { TENANTS } from "@/components/insights/catalog";
import { filterTone, typeLabel } from "@/components/insights/presentation";
import type { InsightOption, InsightType } from "@/components/insights/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusFilter = InsightOption["status"];

export function DashboardToolbar({
  selectedTenantId,
  selectedTenantName,
  activeCount,
  totalCount,
  counts,
  selectorOpen,
  typeFilters,
  statusFilters,
  onTenantChange,
  onOpenSelector,
  onTypeToggle,
  onStatusToggle,
  onClear,
  onFocus,
  onShowAll,
}: {
  selectedTenantId: string;
  selectedTenantName: string;
  activeCount: number;
  totalCount: number;
  counts: Record<InsightType, number>;
  selectorOpen: boolean;
  typeFilters: InsightType[];
  statusFilters: StatusFilter[];
  onTenantChange: (id: string) => void;
  onOpenSelector: () => void;
  onTypeToggle: (type: InsightType) => void;
  onStatusToggle: (status: StatusFilter) => void;
  onClear: () => void;
  onFocus: () => void;
  onShowAll: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{selectedTenantName}</Badge>
          <Badge variant="gold">
            {activeCount}/{totalCount} active
          </Badge>
          <Badge variant="muted">{counts.prediction} predictions</Badge>
          <Badge variant="muted">{counts.anomaly} anomalies</Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          {TENANTS.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => onTenantChange(tenant.id)}
              className={cn(
                "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                filterTone(tenant.id === selectedTenantId),
              )}
            >
              {tenant.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {!selectorOpen ? (
            <Button variant="outline" className="rounded-2xl bg-background/80" onClick={onOpenSelector}>
              <ChevronRight className="size-4" />
              Customize cards
            </Button>
          ) : null}
          {typeFilters.length || statusFilters.length ? (
            <Button variant="outline" className="rounded-2xl bg-background/80" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
          {(["insight", "prediction", "anomaly"] as InsightType[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onTypeToggle(filter)}
              className={cn(
                "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                filterTone(typeFilters.includes(filter)),
              )}
            >
              {typeLabel(filter)}
            </button>
          ))}
          {(["On track", "Watch", "Alert"] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onStatusToggle(filter)}
              className={cn(
                "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                filterTone(statusFilters.includes(filter)),
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl bg-background/80" onClick={onFocus}>
            Focused set
          </Button>
          <Button variant="outline" className="rounded-2xl bg-background/80" onClick={onShowAll}>
            Show all {totalCount}
          </Button>
        </div>
      </div>
    </>
  );
}
