import { AnalystChat } from "@/components/analyst-chat";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function AnalystPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  return (
    <WorkspaceShell
      eyebrow="Analyst"
      title="Talk to your numbers."
      description="A cleaner conversational workspace for asking finance questions, following threads, and refining the answer."
      hidePageHeader
      user={backendUser}
    >
      <AnalystChat userInitial={backendUser.email[0]?.toUpperCase() ?? "U"} />
    </WorkspaceShell>
  );
}
