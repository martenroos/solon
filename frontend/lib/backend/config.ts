export function getBackendConfig() {
  return {
    backendUrl: process.env.BACKEND_URL ?? "http://localhost:8000",
    internalApiKey: process.env.BACKEND_INTERNAL_API_KEY,
    userAuthSecret:
      process.env.BACKEND_USER_AUTH_SECRET ??
      process.env.FRONTEND_USER_AUTH_SECRET ??
      "change-me-user-auth",
  };
}
