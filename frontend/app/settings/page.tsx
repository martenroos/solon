import { SettingsShell } from "@/components/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function SettingsPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  return (
    <WorkspaceShell user={backendUser}>
      <SettingsShell user={backendUser}>
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Badge className="w-fit">Identity</Badge>
              <CardTitle className="text-2xl">Signed-in account</CardTitle>
              <CardDescription>Current workspace identity and provider details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Name</p>
                <p className="mt-2 text-lg font-semibold">{backendUser.name?.trim() || "Not set"}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Email</p>
                <p className="mt-2 text-lg font-semibold">{backendUser.email}</p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Provider</p>
                <p className="mt-2 text-lg font-semibold capitalize">{backendUser.provider}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-[#0B1220] text-white">
            <CardHeader>
              <Badge variant="gold" className="w-fit">Access</Badge>
              <CardTitle className="text-2xl text-white">Workspace permissions</CardTitle>
              <CardDescription className="text-white/70">
                Verification controls workspace entry. Admin privileges unlock user access controls in this settings sidebar.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs tracking-[0.16em] text-white/48 uppercase">Verification</p>
                <p className="mt-2 text-lg font-semibold">{backendUser.is_verified ? "Verified" : "Pending approval"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs tracking-[0.16em] text-white/48 uppercase">Role</p>
                <p className="mt-2 text-lg font-semibold">{backendUser.is_admin ? "Administrator" : "Workspace member"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-white/72">
                {backendUser.is_admin
                  ? "Admin controls now live under the settings sidebar instead of the global workspace header."
                  : "If your role changes later, extra settings options will appear here automatically."}
              </div>
            </CardContent>
          </Card>
        </section>
      </SettingsShell>
    </WorkspaceShell>
  );
}
