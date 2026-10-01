"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { BackendUser } from "@/lib/backend";
import {
  initialTasks,
  readTasksBoard,
  TASKS_BOARD_UPDATED_EVENT,
  type Task,
  type TaskPriority,
  type TaskStatus,
  writeTasksBoard,
} from "@/lib/tasks-board";

import { BoardSummaryCard } from "@/components/tasks/board-summary-card";
import { CreateTaskCard } from "@/components/tasks/create-task-card";
import { columns } from "@/components/tasks/priority";
import { TaskColumn } from "@/components/tasks/task-column";

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
  const [isHydrated, setIsHydrated] = React.useState(false);
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
    setTasks(readTasksBoard(window.localStorage));
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }

    writeTasksBoard(window.localStorage, tasks);
  }, [isHydrated, tasks]);

  React.useEffect(() => {
    function syncTasksFromStorage() {
      setTasks(readTasksBoard(window.localStorage));
    }

    window.addEventListener(TASKS_BOARD_UPDATED_EVENT, syncTasksFromStorage);
    window.addEventListener("storage", syncTasksFromStorage);
    return () => {
      window.removeEventListener(TASKS_BOARD_UPDATED_EVENT, syncTasksFromStorage);
      window.removeEventListener("storage", syncTasksFromStorage);
    };
  }, []);

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

  function handleDrop(columnId: TaskStatus, transferredTaskId: string) {
    const taskId = transferredTaskId || draggedTaskId;
    if (taskId) {
      moveTask(taskId, columnId);
    }
    setDraggedTaskId(null);
    setActiveColumn(null);
  }

  return (
    <section className="grid gap-6 pb-4">
      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <BoardSummaryCard taskCount={taskCount} inFlightCount={inFlightCount} completedCount={completedCount} />
        <CreateTaskCard
          title={title}
          onTitleChange={setTitle}
          ownerId={ownerId}
          onOwnerChange={setOwnerId}
          priority={priority}
          onPriorityChange={setPriority}
          tenantUsers={tenantUsers}
          onCreate={createTask}
        />
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
            {columns.map((column) => (
              <TaskColumn
                key={column.id}
                column={column}
                tasks={tasks.filter((task) => task.status === column.id)}
                isActive={activeColumn === column.id}
                onDragOver={() => {
                  if (activeColumn !== column.id) {
                    setActiveColumn(column.id);
                  }
                }}
                onDragLeave={() => {
                  if (activeColumn === column.id) {
                    setActiveColumn(null);
                  }
                }}
                onDrop={(taskId) => handleDrop(column.id, taskId)}
                onTaskDragStart={setDraggedTaskId}
                onTaskDragEnd={() => {
                  setDraggedTaskId(null);
                  setActiveColumn(null);
                }}
                onTaskDelete={deleteTask}
              />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
