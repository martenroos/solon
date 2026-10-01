import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/tasks-board";
import { cn } from "@/lib/utils";

import type { Column } from "./priority";
import { TaskCard } from "./task-card";

export function TaskColumn({
  column,
  tasks,
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDelete,
}: {
  column: Column;
  tasks: Task[];
  isActive: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (taskId: string) => void;
  onTaskDragStart: (taskId: string) => void;
  onTaskDragEnd: () => void;
  onTaskDelete: (taskId: string) => void;
}) {
  return (
    <section
      className={cn(
        "min-h-[520px] w-[300px] shrink-0 rounded-[1.75rem] border border-border/70 bg-card/78 p-4 shadow-[0_18px_50px_rgba(11,18,32,0.08)] backdrop-blur-md transition md:w-[320px]",
        isActive && "kanban-column-highlight border-primary/30",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/plain");
        onDrop(taskId);
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{column.title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{column.description}</p>
        </div>
        <Badge variant="muted" className="shrink-0">
          {tasks.length}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3">
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 bg-background/45 px-4 py-5 text-sm leading-6 text-muted-foreground">
            Drop tasks here.
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onDragStart={() => onTaskDragStart(task.id)}
              onDragEnd={onTaskDragEnd}
              onDelete={() => onTaskDelete(task.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
