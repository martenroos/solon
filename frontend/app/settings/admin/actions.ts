"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getBackendUser, updateAdminUserAccess } from "@/lib/backend";
import { requireWorkspaceSession } from "@/lib/workspace";

async function requireAdmin() {
  const session = await requireWorkspaceSession();
  const backendUser = await getBackendUser(session.user.email);

  if (!backendUser?.is_admin) {
    redirect("/settings");
  }

  return session.user.email;
}

export async function approveUser(userId: number) {
  const adminEmail = await requireAdmin();
  await updateAdminUserAccess(adminEmail, userId, { is_verified: true });
  revalidatePath("/settings/admin");
}

export async function revokeUser(userId: number) {
  const adminEmail = await requireAdmin();
  await updateAdminUserAccess(adminEmail, userId, { is_verified: false });
  revalidatePath("/settings/admin");
}
