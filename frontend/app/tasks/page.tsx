import { TasksBoard } from "@/components/tasks-board";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceUsers } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function TasksPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();
  const workspaceUsers = await getWorkspaceUsers(backendUser.email);

  return (
    <WorkspaceShell
      eyebrow="Tasks"
      title="Track execution with a shared task board"
      description="Organize work from backlog to done, keep ownership visible, and assign work to users in the same tenant group."
      user={backendUser}
    >
      <TasksBoard currentUser={backendUser} workspaceUsers={workspaceUsers} />
    </WorkspaceShell>
  );
}
