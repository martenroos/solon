import { Card, CardContent } from "@/components/ui/card";
import { MiniAreaChart } from "@/components/charts/mini-area-chart";
import type { BackendFinanceKpi } from "@/lib/backend";
import { cn } from "@/lib/utils";

import { getDeltaTone, getKpiIcon, getSeverityTone } from "./presentation";

export function KpiGrid({ kpis }: { kpis: BackendFinanceKpi[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = getKpiIcon(kpi.label);

        return (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{kpi.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{kpi.value}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-2.5">
                  <Icon className="size-4 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className={cn("text-sm font-medium", getDeltaTone(kpi.delta, kpi.status))}>{kpi.delta}</p>
                <div className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", getSeverityTone(kpi.status))}>
                  {kpi.status}
                </div>
              </div>
              <div className="mt-4 h-12">
                <MiniAreaChart
                  values={kpi.trend}
                  label={kpi.label}
                  color={kpi.status === "Alert" ? "var(--destructive)" : "var(--color-chart-2)"}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
