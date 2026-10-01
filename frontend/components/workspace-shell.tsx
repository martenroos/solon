import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import type { BackendUser } from "@/lib/backend";

type WorkspaceShellProps = {
  user: BackendUser;
  children: ReactNode;
};

export function WorkspaceShell({ user, children }: WorkspaceShellProps) {
  return (
    <main className="box-border h-dvh overflow-hidden bg-transparent p-3 md:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <WorkspaceHeader user={user} />
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </main>
  );
}
