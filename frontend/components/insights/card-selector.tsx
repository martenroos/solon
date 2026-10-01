import { ChevronLeft, Plus } from "lucide-react";

import { typeBadge, typeLabel } from "@/components/insights/presentation";
import type { InsightOption } from "@/components/insights/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CardSelector({
  tenantName,
  activeCount,
  options,
  visibleIds,
  onClose,
  onToggle,
}: {
  tenantName: string;
  activeCount: number;
  options: InsightOption[];
  visibleIds: string[];
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="p-5 pb-4 md:p-6 md:pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Card selector</CardTitle>
            <CardDescription className="mt-2 leading-6">
              Curate the dashboard layout for {tenantName}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gold">
              {activeCount}/{options.length} active
            </Badge>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground"
              aria-label="Collapse card selector"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0 md:p-6 md:pt-0">
        {options.map((item) => (
          <SelectorRow
            key={item.id}
            item={item}
            selected={visibleIds.includes(item.id)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SelectorRow({
  item,
  selected,
  onToggle,
}: {
  item: InsightOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border px-4 py-4 transition",
        selected ? "border-primary/20 bg-primary/8" : "border-border/70 bg-background/75",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-primary/20 bg-primary text-primary-foreground"
              : "border-border/80 bg-muted text-muted-foreground",
          )}
          aria-label={`${selected ? "Hide" : "Show"} ${item.title}`}
        >
          {selected ? "✓" : <Plus className="size-3.5" />}
        </button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{item.title}</p>
            <Badge variant={typeBadge(item.category)}>{typeLabel(item.category)}</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
        </div>
      </div>
    </div>
  );
}
