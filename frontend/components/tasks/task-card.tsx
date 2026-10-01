import { GripVertical, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/tasks-board";
import { cn } from "@/lib/utils";

import { getPriorityTone } from "./priority";

export function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  task: Task;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="kanban-card-pop rounded-3xl border border-border/70 bg-background/90 p-4 shadow-[0_16px_40px_rgba(11,18,32,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(11,18,32,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="size-4" />
          <Badge className={cn("tracking-[0.14em]", getPriorityTone(task.priority))}>
            {task.priority}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Remove
        </button>
      </div>

      <p className="mt-4 text-base font-semibold leading-6">{task.title}</p>

      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" />
        <span>{task.ownerName}</span>
      </div>
    </article>
  );
}
