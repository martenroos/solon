import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendFinanceDashboard } from "@/lib/backend";
import { cn } from "@/lib/utils";

import { getSeverityTone } from "./presentation";

export function ActionsConfidenceCard({ dashboard }: { dashboard: BackendFinanceDashboard }) {
  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Actions & Confidence</CardTitle>
            <CardDescription className="mt-2">
              Immediate steps and trust indicators for the numbers on this page.
            </CardDescription>
          </div>
          <Badge variant="gold">Today</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Confidence</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight">{dashboard.confidence.confidence}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Last sync {dashboard.confidence.lastSync} · {dashboard.confidence.health}
              </p>
            </div>
            <div className={cn("rounded-full border px-3 py-1 text-xs font-medium", getSeverityTone(dashboard.confidence.confidence))}>
              {dashboard.confidence.coverage} coverage
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {dashboard.actions.map((item, index) => (
            <button
              key={item}
              className="flex w-full items-center justify-between gap-4 rounded-3xl border border-border/70 bg-background/80 p-4 text-left transition hover:bg-background"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <p className="text-sm leading-6">{item}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
