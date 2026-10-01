import { CircleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { BackendFinanceDashboard } from "@/lib/backend";
import { cn } from "@/lib/utils";

import { getPriorityIcon, getSeverityTone } from "./presentation";

export function BriefingCard({ dashboard }: { dashboard: BackendFinanceDashboard }) {
  return (
    <Card className="overflow-hidden border-white/70 bg-[#0B1220] text-white">
      <CardContent className="p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-white/50 uppercase">Finance pulse</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance">
              {dashboard.briefing.changed}
            </h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <CircleAlert className="size-5 text-[#9BD7FF]" />
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/74">{dashboard.briefing.summary}</p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {dashboard.priorities.slice(0, 3).map((item) => {
            const Icon = getPriorityIcon(item.title);

            return (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className={cn("rounded-full border px-3 py-1 text-xs font-medium", getSeverityTone(item.severity))}>
                    {item.severity}
                  </div>
                  <Icon className="size-4 text-white/80" />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white">{item.title}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
