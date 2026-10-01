import { getBackendConfig } from "./config";
import type {
  BackendChatChart,
  BackendFinanceOverview,
  BackendSavedChart,
  BackendSavedChartListResponse,
  BackendSavedChartSurface,
} from "./types";

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

export async function getSavedCharts(
  user: { email: string; provider?: string | null },
  surface: BackendSavedChartSurface,
): Promise<BackendSavedChart[]> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  let response: Response;
  try {
    response = await fetch(
      `${backendUrl}/api/v1/finance/saved-charts?surface=${encodeURIComponent(surface)}`,
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
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as BackendSavedChartListResponse;
  return payload.charts;
}

export async function createSavedChart(
  user: { email: string; provider?: string | null },
  payload: {
    surface: BackendSavedChartSurface;
    chart: BackendChatChart;
    source_query_sql?: string | null;
  },
): Promise<BackendSavedChart> {
  const { backendUrl, internalApiKey, userAuthSecret } = getBackendConfig();
  const { createBackendUserAuthToken } = await import("@/lib/backend-user-auth");

  if (!internalApiKey) {
    throw new Error("Missing BACKEND_INTERNAL_API_KEY.");
  }

  const response = await fetch(`${backendUrl}/api/v1/finance/saved-charts`, {
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

  if (!response.ok) {
    let detail = `Failed to save chart (${response.status}).`;
    try {
      const errorPayload = (await response.json()) as { detail?: string };
      detail = errorPayload.detail ?? detail;
    } catch {
      // Use generic detail.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<BackendSavedChart>;
}
