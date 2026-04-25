import { InsightsDashboard } from "@/components/insights-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function InsightsPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  return (
    <WorkspaceShell
      title=""
      description=""
      hidePageHeader
      user={backendUser}
    >
      <InsightsDashboard />
    </WorkspaceShell>
  );
}
