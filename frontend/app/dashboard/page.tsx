import { Badge } from "@/components/ui/badge";
import { ChatChartList } from "@/components/chat-chart-sidebar";
import { ActionsConfidenceCard } from "@/components/dashboard/actions-confidence-card";
import { AttentionMapCard } from "@/components/dashboard/attention-map-card";
import { BriefingCard } from "@/components/dashboard/briefing-card";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { RevenueLiquidityCard } from "@/components/dashboard/revenue-liquidity-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getFinanceOverview, getSavedCharts } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

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
    <WorkspaceShell user={backendUser}>
      <section className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <BriefingCard dashboard={dashboard} />
          <ActionsConfidenceCard dashboard={dashboard} />
        </section>

        <KpiGrid kpis={dashboard.kpis} />

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
          <RevenueLiquidityCard dashboard={dashboard} />
          <AttentionMapCard dashboard={dashboard} />
        </section>
      </section>
    </WorkspaceShell>
  );
}
