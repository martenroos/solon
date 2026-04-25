import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import type { BackendUser } from "@/lib/backend";

type WorkspaceShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  hidePageHeader?: boolean;
  user: BackendUser;
  children: ReactNode;
};

export function WorkspaceShell({
  title,
  description,
  eyebrow = "Workspace",
  hidePageHeader = false,
  user,
  children,
}: WorkspaceShellProps) {
  return (
    <main className="box-border h-dvh overflow-hidden bg-transparent p-3 md:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <WorkspaceHeader user={user} />
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          {hidePageHeader ? null : (
            <header className="shrink-0 rounded-[1.5rem] border border-border/70 bg-card/75 p-5 shadow-[0_18px_50px_rgba(11,18,32,0.1)] backdrop-blur-md">
              <div>
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </header>
          )}
          <div className={hidePageHeader ? "min-h-0 flex-1 overflow-auto" : "mt-4 min-h-0 flex-1 overflow-auto"}>{children}</div>
        </div>
      </div>
    </main>
  );
}
