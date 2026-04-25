import { Download, FileSpreadsheet, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireVerifiedWorkspaceUser } from "@/lib/workspace";

export default async function ReportsPage() {
  const { backendUser } = await requireVerifiedWorkspaceUser();

  return (
    <WorkspaceShell
      eyebrow="Reports"
      title="Package the narrative, not just the numbers."
      description="Reports should export a clear financial story for boards, operators, and investors with minimal editing."
      user={backendUser}
    >
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-white/70 bg-white/82">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge className="w-fit">Templates</Badge>
              <Layers3 className="size-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">Reporting outputs</CardTitle>
            <CardDescription>Start with a structured report template and fill it from live insights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <p className="text-base font-semibold">Board update</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Performance summary, cash position, risks, and decision requests.
              </p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <p className="text-base font-semibold">Operating review</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Weekly driver analysis for finance and cross-functional leads.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-[#0B1220] text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="gold" className="w-fit">Export</Badge>
              <FileSpreadsheet className="size-5 text-[#14B8A6]" />
            </div>
            <CardTitle className="text-2xl">Report assembly</CardTitle>
            <CardDescription className="text-white/70">
              This area is ready for generated decks, PDFs, and investor-ready summaries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">Current status</p>
              <p className="mt-3 text-xl font-semibold">No exports configured yet.</p>
              <Button className="mt-6 rounded-2xl bg-white text-[#0B1220] hover:bg-white/90">
                Prepare export
                <Download className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </WorkspaceShell>
  );
}
