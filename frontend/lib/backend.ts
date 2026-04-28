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

function getBackendConfig() {
  return {
    backendUrl: process.env.BACKEND_URL ?? "http://localhost:8000",
    internalApiKey: process.env.BACKEND_INTERNAL_API_KEY,
    userAuthSecret:
      process.env.BACKEND_USER_AUTH_SECRET ??
      process.env.FRONTEND_USER_AUTH_SECRET ??
      "change-me-user-auth",
  };
}

export async function getFinanceOverview(user: {
  email: string;
  provider?: string | null;
}): Promise<BackendFinanceOverview> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1/finance/overview`, {
      headers: {
        "X-Internal-API-Key": internalApiKey,
        "X-User-Auth": createBackendUserAuthToken({
          email: user.email,
          provider: user.provider,
          secret: userAuthSecret,
        }),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Finance backend is unavailable at ${backendUrl}.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch finance overview (${response.status}).`);
  }

  return response.json() as Promise<BackendFinanceOverview>;
}

export async function getBackendUser(email: string): Promise<BackendUser | null> {
  const { backendUrl, internalApiKey } = getBackendConfig();

  if (!internalApiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/v1/auth/me?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "X-Internal-API-Key": internalApiKey,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<BackendUser>;
  } catch {
    return null;
  }
}

export async function getAdminUsers(adminEmail: string): Promise<BackendUser[]> {
  const { backendUrl, internalApiKey } = getBackendConfig();

  if (!internalApiKey) {
    return [];
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/admin/users`, {
      headers: {
        "X-Internal-API-Key": internalApiKey,
        "X-Admin-Email": adminEmail,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<BackendUser[]>;
  } catch {
    return [];
  }
}

export async function getWorkspaceUsers(email: string): Promise<BackendUser[]> {
  const { backendUrl, internalApiKey } = getBackendConfig();

  if (!internalApiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/v1/auth/workspace-users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "X-Internal-API-Key": internalApiKey,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<BackendUser[]>;
  } catch {
    return [];
  }
}

export async function updateAdminUserAccess(
  adminEmail: string,
  userId: number,
  payload: { is_verified?: boolean; is_admin?: boolean },
): Promise<void> {
  const { backendUrl, internalApiKey } = getBackendConfig();

  if (!internalApiKey) {
    return;
  }

  const response = await fetch(`${backendUrl}/api/v1/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": internalApiKey,
      "X-Admin-Email": adminEmail,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to update user access.");
  }
}

export async function requestBackendChatResponse(
  user: { email: string; provider?: string | null },
  payload: BackendChatRequest,
): Promise<BackendChatResponse> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1/chat/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": internalApiKey,
        "X-User-Auth": createBackendUserAuthToken({
          email: user.email,
          provider: user.provider,
          secret: userAuthSecret,
        }),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new Error(`Chat backend is unavailable at ${backendUrl}.`);
  }

  if (!response.ok) {
    let detail = `Chat request failed with status ${response.status}.`;
    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        detail = errorPayload.detail;
      }
    } catch {
      // Ignore non-JSON error bodies and fall back to the generic message.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<BackendChatResponse>;
}

export async function getBackendChatCapabilities(user: {
  email: string;
  provider?: string | null;
}): Promise<BackendChatCapabilities> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1/chat/capabilities`, {
      headers: {
        "X-Internal-API-Key": internalApiKey,
        "X-User-Auth": createBackendUserAuthToken({
          email: user.email,
          provider: user.provider,
          secret: userAuthSecret,
        }),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Chat backend is unavailable at ${backendUrl}.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch chat capabilities (${response.status}).`);
  }

  return response.json() as Promise<BackendChatCapabilities>;
}

export async function getBackendConversationList(
  user: { email: string; provider?: string | null },
  agent = "analyst",
): Promise<BackendConversationListResponse> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(
      `${backendUrl}/api/v1/chat/conversations?agent=${encodeURIComponent(agent)}`,
      {
        headers: {
          "X-Internal-API-Key": internalApiKey,
          "X-User-Auth": createBackendUserAuthToken({
            email: user.email,
            provider: user.provider,
            secret: userAuthSecret,
          }),
        },
        cache: "no-store",
      },
    );
  } catch {
    throw new Error(`Chat backend is unavailable at ${backendUrl}.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch conversations (${response.status}).`);
  }

  return response.json() as Promise<BackendConversationListResponse>;
}

export async function getBackendConversation(
  user: { email: string; provider?: string | null },
  conversationId: string,
): Promise<BackendConversation> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/v1/chat/conversations/${conversationId}`, {
      headers: {
        "X-Internal-API-Key": internalApiKey,
        "X-User-Auth": createBackendUserAuthToken({
          email: user.email,
          provider: user.provider,
          secret: userAuthSecret,
        }),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Chat backend is unavailable at ${backendUrl}.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch conversation (${response.status}).`);
  }

  return response.json() as Promise<BackendConversation>;
}
