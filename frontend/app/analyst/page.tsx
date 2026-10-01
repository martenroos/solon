import { AnalystChat } from "@/components/analyst-chat";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function AnalystPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  return (
    <WorkspaceShell user={backendUser}>
      <AnalystChat userInitial={backendUser.email[0]?.toUpperCase() ?? "U"} />
    </WorkspaceShell>
  );
}
