import { ArrowRight, DatabaseZap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendFinanceDashboard } from "@/lib/backend";

export function AttentionMapCard({ dashboard }: { dashboard: BackendFinanceDashboard }) {
  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Attention Map</CardTitle>
            <CardDescription className="mt-2">
              Aging pressure, live issues, and next actions in one place.
            </CardDescription>
          </div>
          <DatabaseZap className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-0">
        <div className="space-y-4">
          {dashboard.agingSeries.map((row) => (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="text-muted-foreground">AR {row.ar}% / AP {row.ap}%</span>
              </div>
              <div className="flex gap-2">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/35" style={{ width: `${row.ar}%` }} />
                </div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-2/70" style={{ width: `${row.ap}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Top actions</p>
          <div className="mt-3 space-y-3">
            {dashboard.actions.map((item, index) => (
              <button key={item} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6">{item}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
