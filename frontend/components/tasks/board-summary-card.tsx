import { SquareCheckBig } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BoardSummaryCard({
  taskCount,
  inFlightCount,
  completedCount,
}: {
  taskCount: number;
  inFlightCount: number;
  completedCount: number;
}) {
  return (
    <Card className="overflow-hidden border-white/70 bg-[linear-gradient(155deg,rgba(11,18,32,0.97),rgba(18,33,61,0.94))] text-white">
      <CardHeader className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="gold" className="w-fit">Execution</Badge>
            <CardTitle className="mt-4 text-3xl text-white md:text-4xl">Tasks board for live execution</CardTitle>
            <CardDescription className="mt-3 max-w-2xl text-white/72">
              Capture work, move it across the pipeline, and assign tasks to users from the same tenant group.
            </CardDescription>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 shadow-[0_18px_40px_rgba(8,15,30,0.26)]">
            <SquareCheckBig className="size-6 text-[#9BD7FF]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-3 md:p-7 md:pt-0">
        <MetricCard label="Total tasks" value={String(taskCount)} detail="Tracked on this board" />
        <MetricCard label="In flight" value={String(inFlightCount)} detail="Active or awaiting review" />
        <MetricCard label="Done" value={String(completedCount)} detail="Completed tasks" />
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <p className="text-xs tracking-[0.14em] text-white/50 uppercase">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-white/68">{detail}</p>
    </div>
  );
}
