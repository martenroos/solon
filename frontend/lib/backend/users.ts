import { getBackendConfig } from "./config";
import type { BackendUser } from "./types";

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
