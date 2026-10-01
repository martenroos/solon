import { TrendingUp } from "lucide-react";

import { CashForecastChart, RevenueMarginChart } from "@/components/dashboard/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendFinanceDashboard } from "@/lib/backend";

export function RevenueLiquidityCard({ dashboard }: { dashboard: BackendFinanceDashboard }) {
  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Revenue, Margin, And Liquidity</CardTitle>
            <CardDescription className="mt-2">
              The operating arc right now, from revenue to cash.
            </CardDescription>
          </div>
          <TrendingUp className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 pt-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <RevenueMarginChart data={dashboard.revenueMarginSeries} />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Daily briefing</p>
            <p className="mt-3 text-sm leading-7">{dashboard.briefing.changed}</p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{dashboard.briefing.needsAttention}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Cash forecast</p>
            <div className="mt-4">
              <CashForecastChart data={dashboard.cashForecastSeries} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
