import { getBackendConfig } from "./config";
import type {
  BackendChatCapabilities,
  BackendChatRequest,
  BackendChatResponse,
  BackendConversation,
  BackendConversationListResponse,
} from "./types";

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
