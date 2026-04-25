import { redirect } from "next/navigation";

import { SettingsShell } from "@/components/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAdminUsers } from "@/lib/backend";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

import { approveUser, revokeUser } from "./actions";

export default async function SettingsAdminPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  if (!backendUser.is_admin) {
    redirect("/settings");
  }

  const users = await getAdminUsers(backendUser.email);

  return (
    <WorkspaceShell
      eyebrow="Settings"
      title="Administrative controls"
      description="Manage workspace access from the settings section instead of the primary product navigation."
      hidePageHeader
      user={backendUser}
    >
      <SettingsShell user={backendUser}>
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <Badge variant="gold" className="w-fit">Admin</Badge>
            <CardTitle className="text-2xl">User access</CardTitle>
            <CardDescription>Only verified users can access the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-base font-semibold">{user.name ?? user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex gap-2">
                    <Badge variant={user.is_verified ? "default" : "muted"}>
                      {user.is_verified ? "Verified" : "Pending"}
                    </Badge>
                    {user.is_admin ? <Badge variant="gold">Admin</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-3">
                  <form action={approveUser.bind(null, user.id)}>
                    <Button
                      type="submit"
                      className="rounded-2xl"
                      disabled={user.is_verified}
                    >
                      Approve
                    </Button>
                  </form>
                  <form action={revokeUser.bind(null, user.id)}>
                    <Button
                      type="submit"
                      variant="outline"
                      className="rounded-2xl bg-background/80"
                      disabled={user.is_admin || !user.is_verified}
                    >
                      Revoke
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </SettingsShell>
    </WorkspaceShell>
  );
}
