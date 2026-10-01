import type { TaskPriority, TaskStatus } from "@/lib/tasks-board";

export type Column = {
  id: TaskStatus;
  title: string;
  description: string;
};

export const columns: Column[] = [
  { id: "backlog", title: "Backlog", description: "Captured work that still needs sequencing." },
  { id: "in_progress", title: "In Progress", description: "Tasks actively being worked right now." },
  { id: "review", title: "Review", description: "Work awaiting validation, sign-off, or QA." },
  { id: "done", title: "Done", description: "Completed tasks with a clear outcome." },
];

export function getPriorityTone(priority: TaskPriority) {
  if (priority === "High") {
    return "border-[#C67A4B]/25 bg-[#C67A4B]/12 text-[#9A5B2F] dark:border-[#F0A270]/22 dark:bg-[#F0A270]/12 dark:text-[#F8C39E]";
  }

  if (priority === "Medium") {
    return "border-[#0F766E]/20 bg-[#0F766E]/10 text-[#0F766E] dark:border-[#2DD4BF]/22 dark:bg-[#2DD4BF]/12 dark:text-[#8CF1E3]";
  }

  return "border-border/80 bg-muted text-muted-foreground";
}
