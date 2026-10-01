import { X } from "lucide-react";

import { AnalystEvidenceCard, hasAnalyticsEvidence } from "@/components/insights/evidence-panel";
import { deltaTone, statusTone, typeLabel } from "@/components/insights/presentation";
import { RevenueGrowthChart, RevenueGrowthDetails } from "@/components/insights/revenue-growth-details";
import { SegmentBreakdown } from "@/components/insights/segment-breakdown";
import { InsightSparkline } from "@/components/insights/sparkline";
import type { InsightOption } from "@/components/insights/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function InsightDetailModal({
  item,
  onClose,
}: {
  item: InsightOption;
  onClose: () => void;
}) {
  const Icon = item.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`insight-detail-${item.id}`}
      onMouseDown={onClose}
    >
      <Card
        className={cn(
          "flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl",
          "shadow-[0_28px_120px_rgba(11,18,32,0.32)]",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CardHeader className="sticky top-0 z-10 border-b border-border/70 bg-card/95 p-5 backdrop-blur md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80">
                <Icon className="size-4 text-primary" />
              </span>
              <div className="min-w-0">
                <CardTitle id={`insight-detail-${item.id}`} className="truncate text-xl">
                  {item.title}
                </CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{typeLabel(item.category)}</span>
                  <span className="text-border">/</span>
                  <span>{item.value}</span>
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

        <CardContent className="space-y-5 overflow-y-auto p-5 md:p-6">
          <InsightSummary item={item} />

          <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 p-4">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">What this means</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {item.explanation ?? item.detail}
            </p>
          </div>

          {item.id === "revenue-trend" ? <RevenueGrowthDetails item={item} /> : null}
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

function InsightSummary({ item }: { item: InsightOption }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/55">
        {item.id === "revenue-trend" ? (
          <RevenueGrowthChart item={item} />
        ) : (
          <InsightSparkline item={item} className="h-[132px] w-full" />
        )}
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Current</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{item.metric}</p>
        <p className={cn("mt-2 text-sm font-medium", deltaTone(item.deltaDirection))}>
          {item.delta}
        </p>
        <div
          className={cn(
            "mt-4 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
            statusTone(item.status),
          )}
        >
          {item.status}
        </div>
      </div>
    </div>
  );
}
