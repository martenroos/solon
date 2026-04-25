import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

import type { BackendUser } from "@/lib/backend";

async function syncUserToBackend(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
}): Promise<BackendUser | null> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const internalApiKey = process.env.BACKEND_INTERNAL_API_KEY;

  if (!internalApiKey) {
    return null;
  }

  const response = await fetch(`${backendUrl}/api/v1/auth/sync-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": internalApiKey,
    },
    body: JSON.stringify({
      email: params.email,
      name: params.name ?? null,
      image: params.image ?? null,
      provider: params.provider,
      provider_account_id: params.providerAccountId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to sync user to backend.");
  }

  return (await response.json()) as BackendUser;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    AzureADProvider({
      clientId:
        process.env.AUTH_MICROSOFT_ENTRA_ID_ID ??
        process.env.AZURE_AD_CLIENT_ID ??
        process.env.CLIENT_ID ??
        "",
      clientSecret:
        process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ??
        process.env.AZURE_AD_CLIENT_SECRET ??
        process.env.CLIENT_SECRET ??
        "",
      tenantId:
        process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ??
        process.env.AZURE_AD_TENANT_ID ??
        process.env.TENANT_ID ??
        "common",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email || !account?.provider || !account.providerAccountId) {
        return false;
      }

      const googleVerified =
        account.provider === "google"
          ? Boolean((profile as { email_verified?: boolean } | undefined)?.email_verified)
          : true;
      if (!googleVerified) {
        return false;
      }

      try {
        const backendUser = await syncUserToBackend({
          email: user.email,
          name: user.name,
          image: user.image,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        if (backendUser) {
          (user as typeof user & { isVerified?: boolean; isAdmin?: boolean }).isVerified =
            backendUser.is_verified;
          (user as typeof user & { isVerified?: boolean; isAdmin?: boolean }).isAdmin =
            backendUser.is_admin;
        }
      } catch {
        return false;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.email) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      if (account?.provider) {
        token.provider = account.provider;
      }

      if (user) {
        token.isVerified = Boolean(
          (user as typeof user & { isVerified?: boolean }).isVerified,
        );
        token.isAdmin = Boolean(
          (user as typeof user & { isAdmin?: boolean }).isAdmin,
        );
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string | null | undefined;
        session.user.image = token.picture as string | null | undefined;
        session.user.isVerified = Boolean(token.isVerified);
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.provider = token.provider as string | undefined;
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
