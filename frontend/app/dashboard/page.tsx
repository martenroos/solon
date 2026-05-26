import {
  ArrowRight,
  BarChart3,
  CircleAlert,
  DatabaseZap,
  DollarSign,
  HandCoins,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatChartList } from "@/components/chat-chart-sidebar";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getFinanceOverview, getSavedCharts } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const { backendUser, session } = await requireVerifiedWorkspaceUser();
  const finance = await getFinanceOverview({
    email: session.user.email,
    provider: session.user.provider,
  });
  const savedCharts = await getSavedCharts(
    {
      email: session.user.email,
      provider: session.user.provider,
    },
    "dashboard",
  );
  const dashboard = finance.dashboard;

  return (
    <WorkspaceShell
      eyebrow="Dashboard"
      title="What matters now"
      description="A focused operating view built from high-attention insight signals, core business state, and immediate next actions."
      user={backendUser}
    >
      <section className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Card className="overflow-hidden border-white/70 bg-[#0B1220] text-white">
            <CardContent className="p-7 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-[0.16em] text-white/50 uppercase">Finance pulse</p>
                  <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance">
                    {dashboard.briefing.changed}
                  </h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <CircleAlert className="size-5 text-[#9BD7FF]" />
                </div>
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/74">{dashboard.briefing.summary}</p>

              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {dashboard.priorities.slice(0, 3).map((item) => {
                  const Icon = getPriorityIcon(item.title);

                  return (
                    <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className={cn("rounded-full border px-3 py-1 text-xs font-medium", getSeverityTone(item.severity))}>
                          {item.severity}
                        </div>
                        <Icon className="size-4 text-white/80" />
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-white">{item.title}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/82">
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
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {dashboard.kpis.map((kpi) => {
            const Icon = getKpiIcon(kpi.label);

            return (
              <Card key={kpi.label} className="border-white/70 bg-white/82">
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
                  <div className="mt-4">
                    <Sparkline values={kpi.trend} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {savedCharts.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Saved Live Charts</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Analyst charts refreshed from their saved finance queries.
                  </p>
                </div>
                <Badge variant="muted">Live data</Badge>
              </div>
            </div>
            <ChatChartList charts={savedCharts.map((item) => item.chart)} />
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/70 bg-white/82">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Revenue, Margin, And Liquidity</CardTitle>
                  <CardDescription className="mt-2">
                    The operating arc right now in two visuals.
                  </CardDescription>
                </div>
                <TrendingUp className="size-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 p-6 pt-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="grid h-64 grid-cols-6 items-end gap-4">
                  {dashboard.revenueMarginSeries.map((point) => (
                    <div key={point.label} className="flex h-full flex-col justify-end gap-2">
                      <div className="flex h-full items-end gap-2">
                        <div
                          className="w-full rounded-t-2xl bg-primary/18"
                          style={{ height: `${(point.revenue / 3.2) * 100}%` }}
                        />
                        <div
                          className="w-full rounded-t-2xl bg-chart-2/55"
                          style={{ height: `${(point.margin / 50) * 100}%` }}
                        />
                      </div>
                      <p className="text-center text-xs text-muted-foreground">{point.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-primary/30" />
                    Revenue (€m)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-chart-2/70" />
                    Margin (%)
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                  <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Daily briefing</p>
                  <p className="mt-3 text-sm leading-7">{dashboard.briefing.changed}</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{dashboard.briefing.needsAttention}</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                  <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Cash forecast</p>
                  <div className="mt-4 grid h-36 grid-cols-4 items-end gap-3">
                    {dashboard.cashForecastSeries.map((point) => (
                      <div key={point.label} className="flex h-full flex-col justify-end gap-2">
                        <div className="flex h-full items-end gap-1.5">
                          <div className="w-full rounded-t-xl bg-chart-2/70" style={{ height: `${(point.inflow / 360) * 100}%` }} />
                          <div className="w-full rounded-t-xl bg-chart-5/70" style={{ height: `${(point.outflow / 360) * 100}%` }} />
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">{point.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/82">
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
        </section>
      </section>
    </WorkspaceShell>
  );
}

function getSeverityTone(severity: string) {
  if (severity === "Alert") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  if (severity === "Watch") {
    return "border-[#C2A36B]/20 bg-[#C2A36B]/10 text-[#8A6A35]";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function getPriorityIcon(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("stale") || normalized.includes("sync")) return DatabaseZap;
  if (normalized.includes("receivable") || normalized.includes("overdue")) return HandCoins;
  if (normalized.includes("margin")) return TrendingDown;
  if (normalized.includes("ap")) return Wallet;
  return CircleAlert;
}

function getKpiIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("revenue")) return DollarSign;
  if (normalized.includes("ebitda")) return TrendingUp;
  if (normalized.includes("margin")) return TrendingDown;
  if (normalized.includes("cash")) return Wallet;
  if (normalized.includes("ar")) return HandCoins;
  if (normalized.includes("budget")) return BarChart3;
  if (normalized.includes("sync")) return RefreshCcw;
  return CircleAlert;
}

function getDeltaTone(delta: string, status: string) {
  if (status === "Alert") return "text-destructive";
  if (status === "Watch") return "text-[#8A6A35]";
  if (delta.startsWith("-")) return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-300";
}

function buildSparklinePoints(values: number[]) {
  const width = 100;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
}

function Sparkline({ values }: { values: number[] }) {
  const points = buildSparklinePoints(values);

  return (
    <svg viewBox="0 0 100 36" className="h-12 w-full overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        points={points}
        className="text-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
