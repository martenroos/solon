import { TasksBoard } from "@/components/tasks-board";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceUsers } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function TasksPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();
  const workspaceUsers = await getWorkspaceUsers(backendUser.email);

  return (
    <WorkspaceShell user={backendUser}>
      <TasksBoard currentUser={backendUser} workspaceUsers={workspaceUsers} />
    </WorkspaceShell>
  );
}
