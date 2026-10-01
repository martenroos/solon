import type {
  BackendChatArtifact,
  BackendChatChart,
  BackendChatQueryResult,
  BackendChatTask,
  BackendChatToolCall,
  BackendConversation,
} from "@/lib/backend";
import { type Task } from "@/lib/tasks-board";

import type { ChatBubble } from "./chat-types";

export function toTimestamp() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function formatConversationDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function toChatBubbles(conversation: BackendConversation): ChatBubble[] {
  return conversation.messages
    .filter(
      (
        message,
      ): message is BackendConversation["messages"][number] & { role: "user" | "assistant" } =>
        message.type === "message" && (message.role === "user" || message.role === "assistant"),
    )
    .map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.message,
      timestamp: toTimestamp(),
    }));
}

export function deriveConversationTitle(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}...` : trimmed;
}

export function toCharts(conversation: BackendConversation): BackendChatChart[] {
  return conversation.messages
    .filter(
      (
        message,
      ): message is BackendConversation["messages"][number] & {
        artifact: Extract<BackendChatArtifact, { type: "chart" }>;
      } => message.type === "chart" && message.artifact?.type === "chart",
    )
    .map((message) => message.artifact.chart);
}

export function toTask(task: BackendChatTask): Task {
  return {
    id: task.id,
    title: task.title,
    ownerId: task.owner_id ?? null,
    ownerName: task.owner_name,
    priority: task.priority,
    status: task.status,
  };
}

function isBackendChatTask(value: unknown): value is BackendChatTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BackendChatTask>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (typeof candidate.owner_id === "number" || candidate.owner_id === null || candidate.owner_id === undefined) &&
    typeof candidate.owner_name === "string" &&
    (candidate.priority === "High" || candidate.priority === "Medium" || candidate.priority === "Low") &&
    (
      candidate.status === "backlog" ||
      candidate.status === "in_progress" ||
      candidate.status === "review" ||
      candidate.status === "done"
    )
  );
}

function isQueryResult(value: unknown): value is Omit<BackendChatQueryResult, "id" | "sql"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BackendChatQueryResult>;
  return (
    Array.isArray(candidate.columns) &&
    Array.isArray(candidate.rows) &&
    typeof candidate.row_count === "number" &&
    typeof candidate.max_rows === "number" &&
    typeof candidate.truncated === "boolean"
  );
}

function normalizeQueryResult(
  value: unknown,
  id: string,
  sql?: unknown,
): BackendChatQueryResult | null {
  if (!isQueryResult(value)) {
    return null;
  }

  return {
    id,
    sql: typeof sql === "string" ? sql : null,
    columns: value.columns,
    rows: value.rows as BackendChatQueryResult["rows"],
    row_count: value.row_count,
    max_rows: value.max_rows,
    truncated: value.truncated,
  };
}

export function queryResultsFromToolCalls(toolCalls: BackendChatToolCall[]): BackendChatQueryResult[] {
  return toolCalls
    .filter((toolCall) => toolCall.name === "query_finance_db" && toolCall.status === "completed")
    .map((toolCall) => normalizeQueryResult(toolCall.output, toolCall.id, toolCall.arguments.sql))
    .filter((result): result is BackendChatQueryResult => Boolean(result));
}

export function tasksFromToolCalls(toolCalls: BackendChatToolCall[]): Task[] {
  return toolCalls
    .filter((toolCall) => toolCall.name === "add_task_to_board" && toolCall.status === "completed")
    .map((toolCall) => {
      const output = toolCall.output;
      if (!output || typeof output !== "object") {
        return null;
      }

      const task = (output as { task?: unknown }).task;
      return isBackendChatTask(task) ? toTask(task) : null;
    })
    .filter((task): task is Task => Boolean(task));
}

export function toQueryResults(conversation: BackendConversation): BackendChatQueryResult[] {
  return conversation.messages
    .filter((message) => message.type === "tool" && message.role === "tool")
    .map((message) => {
      try {
        const payload = JSON.parse(message.message) as { result?: unknown };
        return normalizeQueryResult(payload.result, String(message.id));
      } catch {
        return null;
      }
    })
    .filter((result): result is BackendChatQueryResult => Boolean(result));
}
