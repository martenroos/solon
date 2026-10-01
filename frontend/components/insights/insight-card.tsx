import type { ReactNode } from "react";
import { Expand, EyeOff, GripVertical } from "lucide-react";

import { deltaTone, statusTone, typeLabel } from "@/components/insights/presentation";
import { InsightSparkline } from "@/components/insights/sparkline";
import type { CardSize, InsightOption } from "@/components/insights/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CARD_SIZE_OPTIONS: CardSize[] = ["sm", "lg"];

type InsightCardProps = {
  item: InsightOption;
  dragging: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onHide: () => void;
  onSize: (size: CardSize) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (sourceId: string) => void;
};

export function InsightCard({
  item,
  dragging,
  dropTarget,
  onOpen,
  onHide,
  onSize,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: InsightCardProps) {
  const Icon = item.icon;

  return (
    <Card
      onClick={onOpen}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden transition hover:border-primary/25",
        dragging && "opacity-55",
        dropTarget && "ring-2 ring-primary/35",
        item.size === "lg" && "md:col-span-2 xl:col-span-2",
      )}
    >
      <CardHeader className="p-5 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              draggable
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", item.id);
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              className="mt-0.5 cursor-grab rounded-full border border-border/60 bg-background/65 p-1.5 text-muted-foreground"
              aria-label={`Drag ${item.title}`}
            >
              <GripVertical className="size-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/65">
                  <Icon className="size-3.5 text-primary" />
                </span>

                <CardTitle className="min-w-0 flex-1 truncate text-base">
                  {item.title}
                </CardTitle>
              </div>

              <p className="mt-1 truncate pl-9 text-xs text-muted-foreground/60">
                {typeLabel(item.category)} / {item.value}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <CardSizeControl value={item.size} onChange={onSize} />
            <IconButton label={`Hide ${item.title}`} onClick={onHide}>
              <EyeOff className="size-3.5" />
            </IconButton>
            <IconButton label={`Open details for ${item.title}`} onClick={onOpen}>
              <Expand className="size-3.5" />
            </IconButton>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto space-y-4 p-5 pt-0">
        <div className="flex items-end justify-between gap-4 border-t border-border/60 pt-4">
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-tight">{item.metric}</p>
            <p className={cn("mt-1 truncate text-sm font-medium", deltaTone(item.deltaDirection))}>
              {item.delta}
            </p>
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
            <div
              className={cn(
                "ml-auto w-fit max-w-full whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-medium",
                statusTone(item.status),
              )}
            >
              {item.status}
            </div>
          </div>
        </div>
        <div className="h-[96px]">
          <InsightSparkline item={item} />
        </div>
      </CardContent>
    </Card>
  );
}

function CardSizeControl({ value, onChange }: { value: CardSize; onChange: (size: CardSize) => void }) {
  return (
    <div className="flex rounded-full border border-border/60 bg-background/65 p-0.5">
      {CARD_SIZE_OPTIONS.map((size) => (
        <button
          key={size}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange(size);
          }}
          className={cn(
            "flex size-[18px] items-center justify-center rounded-full text-[10px]",
            value === size ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          aria-label={`Set ${size === "lg" ? "wide" : "compact"} size`}
        >
          {size === "lg" ? "W" : "C"}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded-full border border-border/60 bg-background/65 p-1.5 text-muted-foreground"
      aria-label={label}
    >
      {children}
    </button>
  );
}
