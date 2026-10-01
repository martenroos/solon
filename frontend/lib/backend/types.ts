export type BackendUser = {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
  provider: string;
  is_verified: boolean;
  is_admin: boolean;
};

export type BackendChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string | null;
  tool_call_id?: string | null;
};

export type BackendChatRequest = {
  messages: BackendChatMessage[];
  conversation_id?: string;
  system_prompt?: string;
  tools?: string[];
  agent?: string;
  execution_mode?: "single_agent" | "multi_agent";
  metadata?: Record<string, unknown>;
  temperature?: number;
  max_output_tokens?: number;
};

export type BackendChatToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "requested" | "completed" | "failed";
  output?: unknown;
  error?: string | null;
};

export type BackendChatQueryResult = {
  id: string;
  sql?: string | null;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  row_count: number;
  max_rows: number;
  truncated: boolean;
};

export type BackendChatToolInfo = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type BackendChartType = "line" | "bar" | "area" | "pie";

export type BackendChatChartSeries = {
  key: string;
  label: string;
  color?: string | null;
};

export type BackendChatChart = {
  id: string;
  type: BackendChartType;
  title: string;
  description?: string | null;
  data: Array<Record<string, string | number | boolean | null>>;
  series: BackendChatChartSeries[];
  x_key?: string | null;
  label_key?: string | null;
  value_key?: string | null;
  stacked: boolean;
  source_query_sql?: string | null;
};

export type BackendChatTask = {
  id: string;
  title: string;
  owner_id?: number | null;
  owner_name: string;
  priority: "High" | "Medium" | "Low";
  status: "backlog" | "in_progress" | "review" | "done";
};

export type BackendChatChartArtifact = {
  type: "chart";
  chart: BackendChatChart;
  task?: null;
};

export type BackendChatTaskArtifact = {
  type: "task";
  task: BackendChatTask;
  chart?: null;
};

export type BackendChatArtifact = BackendChatChartArtifact | BackendChatTaskArtifact;

export type BackendChatAgentInfo = {
  id: string;
  name: string;
  description: string;
  default_tools: string[];
  allowed_tools: string[];
};

export type BackendChatCapabilities = {
  provider: string;
  default_model?: string | null;
  supported_execution_modes: Array<"single_agent" | "multi_agent">;
  available_agents: BackendChatAgentInfo[];
  available_tools: BackendChatToolInfo[];
};

export type BackendChatResponse = {
  conversation_id: string;
  agent: string;
  execution_mode: "single_agent" | "multi_agent";
  message: BackendChatMessage;
  tool_calls: BackendChatToolCall[];
  artifacts: BackendChatArtifact[];
  model?: string | null;
  metadata: Record<string, unknown>;
};

export type BackendStoredConversationMessage = {
  id: number;
  role: "system" | "user" | "assistant" | "tool";
  agent_name?: string | null;
  type: string;
  message: string;
  artifact?: BackendChatArtifact | null;
  created_at: string;
};

export type BackendConversation = {
  conversation_id: string;
  agent: string;
  messages: BackendStoredConversationMessage[];
};

export type BackendConversationListItem = {
  conversation_id: string;
  agent: string;
  title: string;
  preview?: string | null;
  created_at: string;
};

export type BackendConversationListResponse = {
  conversations: BackendConversationListItem[];
};

export type BackendFinanceKpi = {
  label: string;
  value: string;
  delta: string;
  status: string;
  trend: number[];
};

export type BackendFinancePriority = {
  title: string;
  detail: string;
  severity: string;
};

export type BackendFinanceRevenueMarginPoint = {
  label: string;
  revenue: number;
  margin: number;
};

export type BackendFinanceAgingPoint = {
  label: string;
  ar: number;
  ap: number;
};

export type BackendFinanceCashForecastPoint = {
  label: string;
  inflow: number;
  outflow: number;
};

export type BackendFinanceDashboard = {
  priorities: BackendFinancePriority[];
  kpis: BackendFinanceKpi[];
  revenueMarginSeries: BackendFinanceRevenueMarginPoint[];
  agingSeries: BackendFinanceAgingPoint[];
  cashForecastSeries: BackendFinanceCashForecastPoint[];
  actions: string[];
  confidence: {
    lastSync: string;
    health: string;
    coverage: string;
    confidence: string;
  };
  briefing: {
    summary: string;
    changed: string;
    needsAttention: string;
    improving: string;
    next: string;
  };
};

export type BackendFinanceInsightCard = {
  id: string;
  metric: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
  status: "On track" | "Watch" | "Alert";
  trend: number[];
  segments?: { label: string; value: number; tone: string }[] | null;
  runId?: string | null;
  computedAt?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
  confidence?: number | null;
  explanation?: string | null;
  evidence?: Record<string, unknown> | null;
};

export type BackendFinanceOverview = {
  generatedAt: string;
  companyName?: string | null;
  dashboard: BackendFinanceDashboard;
  insightCards: BackendFinanceInsightCard[];
};

export type BackendSavedChartSurface = "dashboard";

export type BackendSavedChart = {
  id: number;
  surface: BackendSavedChartSurface;
  chart: BackendChatChart;
  source_query_sql: string;
  row_count: number;
  refreshed_at: string;
  error?: string | null;
};

export type BackendSavedChartListResponse = {
  charts: BackendSavedChart[];
};
