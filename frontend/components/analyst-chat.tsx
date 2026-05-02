"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChartColumnBig,
  LoaderCircle,
  MessageSquareText,
  PanelLeft,
  Plus,
  Sparkles,
  SquareCheckBig,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatChartList, ChatQueryResultList } from "@/components/chat-chart-sidebar";
import type {
  BackendChatAgentInfo,
  BackendChatArtifact,
  BackendChatCapabilities,
  BackendChatChart,
  BackendChatQueryResult,
  BackendChatResponse,
  BackendChatTask,
  BackendChatToolCall,
  BackendChatToolInfo,
  BackendConversation,
  BackendConversationListItem,
  BackendSavedChartSurface,
} from "@/lib/backend";
import { addTasksToBoard, type Task } from "@/lib/tasks-board";
import { cn } from "@/lib/utils";

type AnalystChatProps = {
  userInitial: string;
};

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string | null;
};

const FALLBACK_AGENT: BackendChatAgentInfo = {
  id: "analyst",
  name: "Solon Analyst",
  description: "Conversational finance workspace.",
  default_tools: [],
  allowed_tools: [],
};

const starterPrompts = [
  "Why did gross margin fall versus plan this month?",
  "Give me the three biggest cash risks for the next 90 days.",
  "Summarize the operating variance by entity and flag what needs follow-up.",
  "Draft a board-ready explanation for revenue timing changes.",
];

const agentDisplayNameById: Record<string, string> = {
  analyst: "Default agent",
};

const toolDisplayNameById: Record<string, string> = {
  query_finance_db: "Query finance data",
  render_chart: "Include charts",
};

function toTimestamp() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function formatConversationDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function toChatBubbles(conversation: BackendConversation): ChatBubble[] {
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

function deriveConversationTitle(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}...` : trimmed;
}

function getAgentDisplayName(agent: BackendChatAgentInfo) {
  return agentDisplayNameById[agent.id] ?? agent.name;
}

function getToolDisplayName(tool: BackendChatToolInfo) {
  return toolDisplayNameById[tool.name] ?? tool.name;
}

function toCharts(conversation: BackendConversation): BackendChatChart[] {
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

function toTask(task: BackendChatTask): Task {
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

function queryResultsFromToolCalls(toolCalls: BackendChatToolCall[]): BackendChatQueryResult[] {
  return toolCalls
    .filter((toolCall) => toolCall.name === "query_finance_db" && toolCall.status === "completed")
    .map((toolCall) => normalizeQueryResult(toolCall.output, toolCall.id, toolCall.arguments.sql))
    .filter((result): result is BackendChatQueryResult => Boolean(result));
}

function tasksFromToolCalls(toolCalls: BackendChatToolCall[]): Task[] {
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

function toQueryResults(conversation: BackendConversation): BackendChatQueryResult[] {
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

export function AnalystChat({ userInitial }: AnalystChatProps) {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [charts, setCharts] = useState<BackendChatChart[]>([]);
  const [queryResults, setQueryResults] = useState<BackendChatQueryResult[]>([]);
  const [addedTaskTitles, setAddedTaskTitles] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<BackendConversationListItem[]>([]);
  const [capabilities, setCapabilities] = useState<BackendChatCapabilities | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(FALLBACK_AGENT.id);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"conversations" | "results">("conversations");
  const [showChartsScrollTop, setShowChartsScrollTop] = useState(false);
  const [pendingChartAction, setPendingChartAction] = useState<string | null>(null);
  const [addedChartAction, setAddedChartAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent =
    capabilities?.available_agents.find((agent) => agent.id === selectedAgentId) ?? FALLBACK_AGENT;
  const availableToolsByName = new Map(
    (capabilities?.available_tools ?? []).map((tool) => [tool.name, tool] satisfies [string, BackendChatToolInfo]),
  );
  const availableToolsForAgent = selectedAgent.allowed_tools
    .filter((toolName) => toolName !== "add_task_to_board")
    .map((toolName) => availableToolsByName.get(toolName))
    .filter((tool): tool is BackendChatToolInfo => Boolean(tool));

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messages, isPending]);

  useEffect(() => {
    startHistoryTransition(async () => {
      try {
        const response = await fetch("/api/chat/capabilities", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load chat capabilities.");
        }
        const payload = (await response.json()) as BackendChatCapabilities;
        setCapabilities(payload);
        const initialAgent = payload.available_agents[0] ?? FALLBACK_AGENT;
        setSelectedAgentId(initialAgent.id);
        setSelectedTools(initialAgent.default_tools);
      } catch (loadError) {
        const detail =
          loadError instanceof Error ? loadError.message : "Unable to load chat capabilities.";
        setError(detail);
      }
    });
  }, []);

  useEffect(() => {
    startHistoryTransition(async () => {
      try {
        const response = await fetch(`/api/chat/conversations?agent=${encodeURIComponent(selectedAgentId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load previous chats.");
        }
        const payload = (await response.json()) as { conversations: BackendConversationListItem[] };
        setConversations(payload.conversations);
      } catch (loadError) {
        const detail = loadError instanceof Error ? loadError.message : "Unable to load previous chats.";
        setError(detail);
      }
    });
  }, [selectedAgentId]);

  useEffect(() => {
    const element = sidebarScrollContainerRef.current;
    if (!element || sidebarTab !== "results") {
      setShowChartsScrollTop(false);
      return;
    }

    element.scrollTo({ top: 0, behavior: "smooth" });
    setShowChartsScrollTop(false);
  }, [sidebarTab, charts.length, queryResults.length, addedTaskTitles.length]);

  function resetConversation() {
    setConversationId(null);
    setMessages([]);
    setCharts([]);
    setQueryResults([]);
    setAddedTaskTitles([]);
    setInput("");
    setError(null);
    setSelectedTools(selectedAgent.default_tools);
  }

  function upsertConversationList(conversationIdValue: string, title: string, preview: string) {
    setConversations((current) => {
      const nextItem: BackendConversationListItem = {
        conversation_id: conversationIdValue,
        agent: selectedAgent.id,
        title,
        preview,
        created_at: new Date().toISOString(),
      };
      return [nextItem, ...current.filter((item) => item.conversation_id !== conversationIdValue)];
    });
  }

  function appendAssistantMessage(response: BackendChatResponse) {
    setConversationId(response.conversation_id);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message.content,
        timestamp: toTimestamp(),
        model: response.model,
      },
    ]);
    const taskArtifacts = response.artifacts.filter(
      (artifact): artifact is Extract<BackendChatArtifact, { type: "task" }> => artifact.type === "task",
    );
    const tasksById = new Map<string, Task>();
    for (const task of [
      ...taskArtifacts.map((artifact) => toTask(artifact.task)),
      ...tasksFromToolCalls(response.tool_calls),
    ]) {
      tasksById.set(task.id, task);
    }
    const addedTasks = Array.from(tasksById.values());
    if (addedTasks.length > 0) {
      addTasksToBoard(window.localStorage, addedTasks);
      setAddedTaskTitles((current) => [...addedTasks.map((task) => task.title), ...current].slice(0, 6));
      setSidebarTab("results");
    }

    const nextQueryResults = queryResultsFromToolCalls(response.tool_calls);
    if (response.artifacts.length > 0) {
      const chartArtifacts = response.artifacts.filter(
        (artifact): artifact is Extract<BackendChatArtifact, { type: "chart" }> => artifact.type === "chart",
      );
      if (chartArtifacts.length > 0) {
        const fallbackSourceSql = [...nextQueryResults].reverse().find((result) => result.sql)?.sql ?? null;
        setCharts((current) => [
          ...current,
          ...chartArtifacts.map((artifact) => ({
            ...artifact.chart,
            source_query_sql: artifact.chart.source_query_sql ?? fallbackSourceSql,
          })),
        ]);
        setSidebarTab("results");
      }
    }
    if (nextQueryResults.length > 0) {
      setQueryResults((current) => [...current, ...nextQueryResults]);
      setSidebarTab("results");
    }
  }

  function toggleTool(toolName: string) {
    setSelectedTools((current) => {
      if (selectedAgent.default_tools.includes(toolName)) {
        return current;
      }
      return current.includes(toolName)
        ? current.filter((name) => name !== toolName)
        : [...current, toolName];
    });
  }

  function loadConversation(nextConversationId: string) {
    if (isPending || isHistoryPending) {
      return;
    }

    setError(null);
    startHistoryTransition(async () => {
      try {
        const response = await fetch(`/api/chat/conversations/${nextConversationId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load conversation.");
        }
        const payload = (await response.json()) as BackendConversation;
        const nextMessages = toChatBubbles(payload);
        const nextCharts = toCharts(payload);
        const nextQueryResults = toQueryResults(payload);
        setConversationId(payload.conversation_id);
        setMessages(nextMessages);
        setCharts(nextCharts);
        setQueryResults(nextQueryResults);
        setAddedTaskTitles([]);
      } catch (loadError) {
        const detail = loadError instanceof Error ? loadError.message : "Unable to load conversation.";
        setError(detail);
      }
    });
  }

  function handleSidebarScroll() {
    if (sidebarTab !== "results") {
      return;
    }

    const element = sidebarScrollContainerRef.current;
    setShowChartsScrollTop((element?.scrollTop ?? 0) > 120);
  }

  function scrollChartsToTop() {
    sidebarScrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setShowChartsScrollTop(false);
  }

  function submitMessage(content: string, requestTools = selectedTools, displayContent = content) {
    const trimmed = content.trim();
    const visibleContent = displayContent.trim() || trimmed;
    if (!trimmed || isPending) {
      return;
    }

    const userMessage: ChatBubble = {
      id: crypto.randomUUID(),
      role: "user",
      content: visibleContent,
      timestamp: toTimestamp(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsToolMenuOpen(false);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/chat/respond", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: trimmed,
              },
            ],
            conversation_id: conversationId ?? undefined,
            agent: selectedAgent.id,
            tools: requestTools,
            execution_mode: "single_agent",
            metadata: {
              surface: "analyst-page",
              selected_agent: selectedAgent.id,
            },
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ detail: "Request failed." }))) as {
            detail?: string;
          };
          throw new Error(payload.detail ?? "Request failed.");
        }

        const payload = (await response.json()) as BackendChatResponse;
        appendAssistantMessage(payload);
        upsertConversationList(payload.conversation_id, deriveConversationTitle(visibleContent), payload.message.content);
      } catch (requestError) {
        const detail =
          requestError instanceof Error ? requestError.message : "Something went wrong.";
        setError(detail);
      }
    });
  }

  function createTaskFromConversation() {
    if (messages.length === 0 || isPending) {
      return;
    }

    setIsToolMenuOpen(false);
    submitMessage(
      "Create exactly one concise task from the latest actionable part of this conversation. If there is no actionable follow-up, say so and do not create a task.",
      ["add_task_to_board"],
    );
  }

  async function addChartToSurface(chart: BackendChatChart, surface: BackendSavedChartSurface) {
    const sourceQuerySql = getChartSourceQuerySql(chart);
    const actionKey = `${chart.id}:${surface}`;
    setPendingChartAction(actionKey);
    setError(null);
    if (!sourceQuerySql) {
      setError("This chart cannot be saved yet because it does not include the SQL query used to build it.");
      setPendingChartAction(null);
      return;
    }
    try {
      const response = await fetch("/api/finance/saved-charts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surface,
          chart: {
            ...chart,
            source_query_sql: sourceQuerySql,
          },
          source_query_sql: sourceQuerySql,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ detail: "Unable to save chart." }))) as {
          detail?: string;
        };
        throw new Error(payload.detail ?? "Unable to save chart.");
      }
      setAddedChartAction(actionKey);
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : "Unable to save chart.";
      setError(detail);
    } finally {
      setPendingChartAction(null);
    }
  }

  function getChartSourceQuerySql(chart: BackendChatChart) {
    return chart.source_query_sql ?? [...queryResults].reverse().find((result) => result.sql)?.sql ?? null;
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      <aside
        className={cn(
          "flex min-h-0 flex-col rounded-[1.5rem] border border-border/70 bg-card/80 shadow-[0_18px_50px_rgba(11,18,32,0.08)] backdrop-blur-md transition-all duration-200 lg:self-stretch",
          isSidebarOpen ? "w-full p-3 lg:w-80 lg:min-w-80" : "w-full p-2 lg:w-16 lg:min-w-16",
        )}
      >
        <div className={cn("flex items-center", isSidebarOpen ? "justify-between gap-2" : "flex-col gap-2")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => setIsSidebarOpen((current) => !current)}
            aria-label={isSidebarOpen ? "Collapse previous chats" : "Expand previous chats"}
          >
            {isSidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          <Button
            type="button"
            variant={isSidebarOpen ? "outline" : "ghost"}
            size={isSidebarOpen ? "sm" : "icon-sm"}
            className={cn("rounded-full", isSidebarOpen ? "px-3" : "")}
            onClick={resetConversation}
            aria-label="Start new chat"
          >
            <Plus className="size-4" />
            {isSidebarOpen ? <span>New chat</span> : null}
          </Button>
        </div>

        {isSidebarOpen ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSidebarTab("conversations")}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition",
                  sidebarTab === "conversations"
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
                )}
              >
                Chats
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("results")}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition",
                  sidebarTab === "results"
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
                )}
              >
                Results
              </button>
            </div>
            <div className="relative mt-3 min-h-0 flex-1">
              <div
                ref={sidebarScrollContainerRef}
                className="h-full overflow-y-auto"
                onScroll={handleSidebarScroll}
              >
                {sidebarTab === "conversations" ? (
                  <div className="space-y-2">
                    {conversations.map((item) => {
                      const isActive = item.conversation_id === conversationId;
                      return (
                        <button
                          key={item.conversation_id}
                          type="button"
                          onClick={() => loadConversation(item.conversation_id)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition",
                            isActive
                              ? "border-primary/30 bg-primary/8"
                              : "border-border/60 bg-background/65 hover:border-primary/20 hover:bg-background/85",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              {formatConversationDate(item.created_at)}
                            </span>
                          </div>
                          {item.preview ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {item.preview}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                    {!isHistoryPending && conversations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-3 py-4 text-sm text-muted-foreground">
                        No previous chats yet.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {addedTaskTitles.length > 0 ? (
                      <div className="rounded-2xl border border-primary/20 bg-primary/7 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <SquareCheckBig className="size-4 text-primary" />
                          Added to task board
                        </div>
                        <div className="mt-3 space-y-2">
                          {addedTaskTitles.map((taskTitle) => (
                            <p key={taskTitle} className="text-sm leading-5 text-muted-foreground">
                              {taskTitle}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {queryResults.length > 0 ? (
                      <ChatQueryResultList queryResults={queryResults} />
                    ) : null}
                    {charts.length > 0 ? (
                      <ChatChartList
                        charts={charts}
                        onAddToSurface={addChartToSurface}
                        getSourceQuerySql={getChartSourceQuerySql}
                        pendingChartAction={pendingChartAction}
                        addedChartAction={addedChartAction}
                      />
                    ) : null}
                    {queryResults.length === 0 && charts.length === 0 && addedTaskTitles.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-4 py-6 text-sm text-muted-foreground">
                        Query results, charts, and tasks created during the conversation will appear here.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {sidebarTab === "results" && showChartsScrollTop ? (
                <Button
                  type="button"
                  size="icon-sm"
                  className="absolute right-4 bottom-4 z-10 rounded-full shadow-lg"
                  onClick={scrollChartsToTop}
                  aria-label="Scroll charts to top"
                >
                  <ArrowUp className="size-4" />
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-1 flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
              <PanelLeft className="size-4" />
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
              <MessageSquareText className="size-4" />
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
              <ChartColumnBig className="size-4" />
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/78 p-4 shadow-[0_22px_60px_rgba(11,18,32,0.1)] backdrop-blur-md sm:p-5">

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
          <div className="space-y-5 pb-4">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isAssistant ? "items-start" : "justify-end"}`}
                >
                  {isAssistant ? (
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </div>
                  ) : null}

                  <div className={`max-w-3xl ${isAssistant ? "" : "flex justify-end"}`}>
                    <div
                      className={
                        isAssistant
                          ? "rounded-[1.25rem] bg-transparent px-1 py-1"
                          : "rounded-[1.25rem] rounded-tr-md bg-[#0B1220] px-4 py-3.5 text-white shadow-[0_14px_30px_rgba(11,18,32,0.16)]"
                      }
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className={isAssistant ? "font-medium text-foreground" : "font-medium text-white"}>
                          {isAssistant ? getAgentDisplayName(selectedAgent) : "You"}
                        </span>
                        <span className={isAssistant ? "text-muted-foreground" : "text-white/55"}>
                          {message.timestamp}
                        </span>
                        {isAssistant && message.model ? (
                          <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {message.model}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`mt-2.5 whitespace-pre-wrap text-sm leading-7 ${
                          isAssistant ? "text-foreground" : "text-white/88"
                        }`}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>

                  {!isAssistant ? (
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white/70 text-sm font-semibold text-foreground shadow-sm">
                      {userInitial}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {isPending ? (
              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <LoaderCircle className="size-4 animate-spin" />
                </div>
                <div className="rounded-[1.25rem] bg-transparent px-1 py-1 text-sm text-muted-foreground">
                  Thinking...
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-3 shrink-0">
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
                disabled={isPending}
              className="rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-[1.25rem] border border-border/80 bg-background/86 p-3 shadow-[0_12px_30px_rgba(11,18,32,0.06)]">
            <textarea
              className="min-h-24 w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={`Message ${getAgentDisplayName(selectedAgent)}...`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(input);
                }
              }}
            />
            <div className="relative mt-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className={cn(
                  "rounded-full",
                  isToolMenuOpen ? "border-primary/35 bg-primary/10 text-primary" : "",
                )}
                onClick={() => setIsToolMenuOpen((current) => !current)}
                disabled={isPending}
                aria-label="Open chat tools"
                aria-expanded={isToolMenuOpen}
              >
                <Plus className="size-4" />
              </Button>
              {isToolMenuOpen ? (
                <div className="absolute bottom-12 left-0 z-20 w-72 rounded-2xl border border-border bg-white p-3 shadow-[0_18px_50px_rgba(11,18,32,0.16)] dark:bg-[#252832]">
                  <div className="space-y-2">
                    {availableToolsForAgent.map((tool) => {
                      const isDefault = selectedAgent.default_tools.includes(tool.name);
                      const isActive = isDefault || selectedTools.includes(tool.name);
                      return (
                        <button
                          key={tool.name}
                          type="button"
                          onClick={() => toggleTool(tool.name)}
                          disabled={isPending || isDefault}
                          title={tool.description}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                            isActive
                              ? "border-primary/35 bg-primary/10 text-foreground"
                              : "border-border/70 bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground",
                            isDefault ? "cursor-default" : "",
                          )}
                        >
                          <span>{getToolDisplayName(tool)}</span>
                          <span className="text-xs text-muted-foreground">{isActive ? "On" : "Off"}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={createTaskFromConversation}
                      disabled={isPending || messages.length === 0}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/25 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="flex items-center gap-2">
                        <SquareCheckBig className="size-4 text-primary" />
                        Create task
                      </span>
                      <span className="text-xs text-muted-foreground">Manual</span>
                    </button>
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                className="rounded-full px-4"
                onClick={() => submitMessage(input)}
                disabled={isPending || input.trim().length === 0}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
