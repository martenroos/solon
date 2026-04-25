import type { ReactNode } from "react";

import { SettingsSidebar } from "@/components/settings-sidebar";
import type { BackendUser } from "@/lib/backend";

export function SettingsShell({
  user,
  children,
}: {
  user: BackendUser;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
      <SettingsSidebar user={user} />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
