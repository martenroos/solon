"use client";

import * as React from "react";
import { GripVertical, Plus, SquareCheckBig, Target, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackendUser } from "@/lib/backend";
import { cn } from "@/lib/utils";

type TaskStatus = "backlog" | "in_progress" | "review" | "done";
type TaskPriority = "High" | "Medium" | "Low";

type Task = {
  id: string;
  title: string;
  ownerId: number | null;
  ownerName: string;
  priority: TaskPriority;
  status: TaskStatus;
};

type Column = {
  id: TaskStatus;
  title: string;
  description: string;
};

const STORAGE_KEY = "solon-tasks-board-v1";
const LEGACY_STORAGE_KEY = "solon-kanban-board-v1";

const columns: Column[] = [
  { id: "backlog", title: "Backlog", description: "Captured work that still needs sequencing." },
  { id: "in_progress", title: "In Progress", description: "Tasks actively being worked right now." },
  { id: "review", title: "Review", description: "Work awaiting validation, sign-off, or QA." },
  { id: "done", title: "Done", description: "Completed tasks with a clear outcome." },
];

const initialTasks: Task[] = [
  {
    id: "task-1",
    title: "Define KPI tiles for the weekly finance view",
    ownerId: null,
    ownerName: "Marten",
    priority: "High",
    status: "in_progress",
  },
  {
    id: "task-2",
    title: "Review invoice sync exceptions from North Holding",
    ownerId: null,
    ownerName: "Finance Ops",
    priority: "High",
    status: "review",
  },
  {
    id: "task-3",
    title: "Draft board-ready commentary for margin compression",
    ownerId: null,
    ownerName: "Analyst",
    priority: "Medium",
    status: "backlog",
  },
  {
    id: "task-4",
    title: "Publish investor export template",
    ownerId: null,
    ownerName: "Ops",
    priority: "Low",
    status: "done",
  },
];

function getPriorityTone(priority: TaskPriority) {
  if (priority === "High") {
    return "border-[#C67A4B]/25 bg-[#C67A4B]/12 text-[#9A5B2F] dark:border-[#F0A270]/22 dark:bg-[#F0A270]/12 dark:text-[#F8C39E]";
  }

  if (priority === "Medium") {
    return "border-[#0F766E]/20 bg-[#0F766E]/10 text-[#0F766E] dark:border-[#2DD4BF]/22 dark:bg-[#2DD4BF]/12 dark:text-[#8CF1E3]";
  }

  return "border-border/80 bg-muted text-muted-foreground";
}

export function TasksBoard({
  currentUser,
  workspaceUsers,
}: {
  currentUser: BackendUser;
  workspaceUsers: BackendUser[];
}) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [title, setTitle] = React.useState("");
  const [ownerId, setOwnerId] = React.useState("unassigned");
  const [priority, setPriority] = React.useState<TaskPriority>("Medium");
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [activeColumn, setActiveColumn] = React.useState<TaskStatus | null>(null);
  const hydratedRef = React.useRef(false);
  const tenantUsers = React.useMemo(() => {
    const currentDomain = currentUser.email.split("@")[1]?.toLowerCase() ?? "";
    const scopedUsers = workspaceUsers.filter((user) => {
      const userDomain = user.email.split("@")[1]?.toLowerCase() ?? "";
      return currentDomain ? userDomain === currentDomain : true;
    });

    const users = scopedUsers.some((user) => user.id === currentUser.id)
      ? scopedUsers
      : [currentUser, ...scopedUsers];

    return users
      .filter((user, index, collection) => collection.findIndex((candidate) => candidate.id === user.id) === index)
      .sort((left, right) =>
        (left.name?.trim() || left.email).localeCompare(right.name?.trim() || right.email),
      );
  }, [currentUser, workspaceUsers]);

  React.useEffect(() => {
    const savedBoard = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!savedBoard) {
      hydratedRef.current = true;
      return;
    }

    try {
      const parsedBoard = JSON.parse(savedBoard) as Task[];
      if (Array.isArray(parsedBoard)) {
        setTasks(parsedBoard);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    hydratedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const taskCount = tasks.length;
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const inFlightCount = tasks.filter((task) => task.status === "in_progress" || task.status === "review").length;

  function createTask() {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      return;
    }

    const selectedOwner = tenantUsers.find((user) => String(user.id) === ownerId);

    const task: Task = {
      id: crypto.randomUUID(),
      title: normalizedTitle,
      ownerId: selectedOwner?.id ?? null,
      ownerName: selectedOwner?.name?.trim() || selectedOwner?.email || "Unassigned",
      priority,
      status: "backlog",
    };

    setTasks((currentTasks) => [task, ...currentTasks]);
    setTitle("");
    setOwnerId("unassigned");
    setPriority("Medium");
  }

  function moveTask(taskId: string, nextStatus: TaskStatus) {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
    );
  }

  function deleteTask(taskId: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  }

  return (
    <section className="grid gap-6 pb-4">
      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
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

        <Card className="border-white/70 bg-white/84">
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title"
              aria-label="Task title"
              className="flex h-12 w-full rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10"
            />
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="flex items-center rounded-2xl border border-border/80 bg-background/80 px-4">
                <span className="sr-only">Task assignee</span>
                <select
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
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
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                  className="h-12 w-full bg-transparent text-sm outline-none"
                  aria-label="Task priority"
                >
                  <option value="High">High priority</option>
                  <option value="Medium">Medium priority</option>
                  <option value="Low">Low priority</option>
                </select>
              </label>
            </div>
            <Button onClick={createTask} className="w-full rounded-2xl sm:w-fit">
              <Plus className="size-4" />
              Add to backlog
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-[1.85rem] border border-border/70 bg-card/55 p-3 shadow-[0_18px_50px_rgba(11,18,32,0.06)] backdrop-blur-md md:p-4">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Board</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Move work across the flow</h2>
          </div>
          <Badge variant="muted">{columns.length} columns</Badge>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          const isActive = activeColumn === column.id;

          return (
            <section
              key={column.id}
              className={cn(
                "min-h-[520px] w-[300px] shrink-0 rounded-[1.75rem] border border-border/70 bg-card/78 p-4 shadow-[0_18px_50px_rgba(11,18,32,0.08)] backdrop-blur-md transition md:w-[320px]",
                isActive && "kanban-column-highlight border-primary/30",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                if (activeColumn !== column.id) {
                  setActiveColumn(column.id);
                }
              }}
              onDragLeave={() => {
                if (activeColumn === column.id) {
                  setActiveColumn(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                if (taskId) {
                  moveTask(taskId, column.id);
                }
                setDraggedTaskId(null);
                setActiveColumn(null);
              }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{column.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{column.description}</p>
                </div>
                <Badge variant="muted" className="shrink-0">
                  {columnTasks.length}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3">
                {columnTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/80 bg-background/45 px-4 py-5 text-sm leading-6 text-muted-foreground">
                    Drop tasks here.
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        setDraggedTaskId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setActiveColumn(null);
                      }}
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
                          onClick={() => deleteTask(task.id)}
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
                  ))
                )}
              </div>
            </section>
          );
            })}
          </div>
        </div>
      </section>
    </section>
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
