import { useEffect, useRef, useState, useTransition } from "react";

import type {
  BackendChatArtifact,
  BackendChatCapabilities,
  BackendChatChart,
  BackendChatQueryResult,
  BackendChatResponse,
  BackendChatToolInfo,
  BackendConversation,
  BackendConversationListItem,
  BackendSavedChartSurface,
} from "@/lib/backend";
import { addTasksToBoard, type Task } from "@/lib/tasks-board";

import {
  deriveConversationTitle,
  queryResultsFromToolCalls,
  tasksFromToolCalls,
  toCharts,
  toChatBubbles,
  toQueryResults,
  toTask,
  toTimestamp,
} from "./chat-mappers";
import { FALLBACK_AGENT } from "./chat-types";
import type { ChatBubble } from "./chat-types";

export function useAnalystChat() {
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

  function getChartSourceQuerySql(chart: BackendChatChart) {
    return chart.source_query_sql ?? [...queryResults].reverse().find((result) => result.sql)?.sql ?? null;
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

  return {
    messages,
    charts,
    queryResults,
    addedTaskTitles,
    conversationId,
    conversations,
    selectedAgent,
    selectedTools,
    availableToolsForAgent,
    input,
    setInput,
    error,
    isSidebarOpen,
    setIsSidebarOpen,
    isToolMenuOpen,
    setIsToolMenuOpen,
    sidebarTab,
    setSidebarTab,
    showChartsScrollTop,
    pendingChartAction,
    addedChartAction,
    isPending,
    isHistoryPending,
    scrollContainerRef,
    sidebarScrollContainerRef,
    resetConversation,
    toggleTool,
    loadConversation,
    handleSidebarScroll,
    scrollChartsToTop,
    submitMessage,
    createTaskFromConversation,
    addChartToSurface,
    getChartSourceQuerySql,
  };
}

export type AnalystChatState = ReturnType<typeof useAnalystChat>;
