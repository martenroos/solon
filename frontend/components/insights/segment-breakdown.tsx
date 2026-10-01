import { segmentColor } from "@/components/insights/presentation";
import type { InsightOption } from "@/components/insights/types";
import { cn } from "@/lib/utils";

export function SegmentBreakdown({ item }: { item: InsightOption }) {
  if (!item.segments?.length) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Composition</p>
        <p className="text-xs text-muted-foreground">{item.metric}</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[132px_1fr] md:items-center">
        <RadialBreakdown segments={item.segments} />
        <div className="grid gap-2">
          {item.segments.map((segment, index) => (
            <div
              key={segment.label}
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", segment.tone)} />
                {segment.label}
              </span>
              <span className="font-semibold" style={{ color: segmentColor(index) }}>
                {segment.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RadialBreakdown({ segments }: { segments: { label: string; value: number; tone: string }[] }) {
  const center = 66;

  return (
    <div className="flex items-center justify-center">
      <svg viewBox="0 0 132 132" className="size-[132px]">
        {segments.map((segment, index) => {
          const radius = 46 - index * 12;
          const circumference = 2 * Math.PI * radius;
          const dash = (segment.value / 100) * circumference;
          return (
            <g key={segment.label} transform={`rotate(-90 ${center} ${center})`}>
              <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} opacity="0.35" />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segmentColor(index)}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
              />
            </g>
          );
        })}
        <circle cx={center} cy={center} r="20" fill="white" />
        <text x={center} y={center - 2} textAnchor="middle" className="fill-foreground text-[16px] font-semibold">
          {segments[0]?.value ?? 0}%
        </text>
      </svg>
    </div>
  );
}
