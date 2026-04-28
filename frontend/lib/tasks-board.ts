export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "High" | "Medium" | "Low";

export type Task = {
  id: string;
  title: string;
  ownerId: number | null;
  ownerName: string;
  priority: TaskPriority;
  status: TaskStatus;
};

export const TASKS_BOARD_STORAGE_KEY = "solon-tasks-board-v1";
export const LEGACY_TASKS_BOARD_STORAGE_KEY = "solon-kanban-board-v1";
export const TASKS_BOARD_UPDATED_EVENT = "solon-tasks-board-updated";

export const initialTasks: Task[] = [
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

export function readTasksBoard(storage: Storage): Task[] {
  const savedBoard =
    storage.getItem(TASKS_BOARD_STORAGE_KEY) ?? storage.getItem(LEGACY_TASKS_BOARD_STORAGE_KEY);

  if (!savedBoard) {
    return initialTasks;
  }

  try {
    const parsedBoard = JSON.parse(savedBoard) as unknown;
    if (Array.isArray(parsedBoard)) {
      return parsedBoard.filter(isTask);
    }
  } catch {
    storage.removeItem(TASKS_BOARD_STORAGE_KEY);
  }

  return initialTasks;
}

export function writeTasksBoard(storage: Storage, tasks: Task[]) {
  storage.setItem(TASKS_BOARD_STORAGE_KEY, JSON.stringify(tasks));
}

export function addTasksToBoard(storage: Storage, nextTasks: Task[]) {
  const currentTasks = readTasksBoard(storage);
  const existingIds = new Set(currentTasks.map((task) => task.id));
  const uniqueNextTasks = nextTasks.filter((task) => !existingIds.has(task.id));

  if (uniqueNextTasks.length === 0) {
    return currentTasks;
  }

  const updatedTasks = [...uniqueNextTasks, ...currentTasks];
  writeTasksBoard(storage, updatedTasks);
  window.dispatchEvent(new Event(TASKS_BOARD_UPDATED_EVENT));
  return updatedTasks;
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Task>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (typeof candidate.ownerId === "number" || candidate.ownerId === null) &&
    typeof candidate.ownerName === "string" &&
    isTaskPriority(candidate.priority) &&
    isTaskStatus(candidate.status)
  );
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === "High" || value === "Medium" || value === "Low";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "backlog" || value === "in_progress" || value === "review" || value === "done";
}
