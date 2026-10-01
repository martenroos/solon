import { InsightsDashboard } from "@/components/insights-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getFinanceOverview } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function InsightsPage() {
  const { backendUser, session } = await requireVerifiedWorkspaceUser();
  const finance = await getFinanceOverview({
    email: session.user.email,
    provider: session.user.provider,
  });

  return (
    <WorkspaceShell user={backendUser}>
      <InsightsDashboard cards={finance.insightCards} />
    </WorkspaceShell>
  );
}
