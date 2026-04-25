import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getBackendUser } from "@/lib/backend";

export async function requireWorkspaceSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return session;
}

export async function requireVerifiedWorkspaceUser() {
  const session = await requireWorkspaceSession();

  const backendUser = await getBackendUser(session.user.email);
  if (!backendUser?.is_verified) {
    redirect("/login");
  }

  return { session, backendUser };
}
