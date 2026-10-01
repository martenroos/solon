import type { BackendChatAgentInfo, BackendChatToolInfo } from "@/lib/backend";

export type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string | null;
};

export const FALLBACK_AGENT: BackendChatAgentInfo = {
  id: "analyst",
  name: "Solon Analyst",
  description: "Conversational finance workspace.",
  default_tools: [],
  allowed_tools: [],
};

export const starterPrompts = [
  "Why did gross margin fall versus plan this month?",
  "Give me the three biggest cash risks for the next 90 days.",
  "Summarize the operating variance by entity and flag what needs follow-up.",
  "Draft a board-ready explanation for revenue timing changes.",
];

const agentDisplayNameById: Record<string, string> = {
  analyst: "Solon",
};

const toolDisplayNameById: Record<string, string> = {
  query_finance_db: "Query finance data",
  render_chart: "Include charts",
};

export function getAgentDisplayName(agent: BackendChatAgentInfo) {
  return agentDisplayNameById[agent.id] ?? agent.name;
}

export function getToolDisplayName(tool: BackendChatToolInfo) {
  return toolDisplayNameById[tool.name] ?? tool.name;
}
