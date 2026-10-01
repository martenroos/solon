import { Plus, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendUser } from "@/lib/backend";
import type { TaskPriority } from "@/lib/tasks-board";

export function CreateTaskCard({
  title,
  onTitleChange,
  ownerId,
  onOwnerChange,
  priority,
  onPriorityChange,
  tenantUsers,
  onCreate,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  ownerId: string;
  onOwnerChange: (value: string) => void;
  priority: TaskPriority;
  onPriorityChange: (value: TaskPriority) => void;
  tenantUsers: BackendUser[];
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge className="w-fit">Add Task</Badge>
            <CardTitle className="mt-4 text-2xl">Create a new work item</CardTitle>
            <CardDescription className="mt-2">
              New tasks land in backlog first, with assignees selected from verified users on your tenant domain.
            </CardDescription>
          </div>
          <Target className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-0">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Task title"
          aria-label="Task title"
          className="flex h-12 w-full rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10"
        />
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="flex items-center rounded-2xl border border-border/80 bg-background/80 px-4">
            <span className="sr-only">Task assignee</span>
            <select
              value={ownerId}
              onChange={(event) => onOwnerChange(event.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none"
              aria-label="Task assignee"
            >
              <option value="unassigned">Unassigned</option>
              {tenantUsers.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name?.trim() || user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center rounded-2xl border border-border/80 bg-background/80 px-4">
            <span className="sr-only">Priority</span>
            <select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as TaskPriority)}
              className="h-12 w-full bg-transparent text-sm outline-none"
              aria-label="Task priority"
            >
              <option value="High">High priority</option>
              <option value="Medium">Medium priority</option>
              <option value="Low">Low priority</option>
            </select>
          </label>
        </div>
        <Button onClick={onCreate} className="w-full rounded-2xl sm:w-fit">
          <Plus className="size-4" />
          Add to backlog
        </Button>
      </CardContent>
    </Card>
  );
}
