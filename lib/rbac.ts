import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { isOpsAdmin as legacyOpsAdmin } from "@/lib/ops/auth";

export type UserRole = "user" | "support" | "admin" | "super_admin";

const ROLE_ORDER: Record<UserRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
};

export async function getUserRole(userId: string): Promise<{ role: UserRole; hasRow: boolean }> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error || !data) {
    return { role: "user", hasRow: false };
  }
  return { role: (data.role as UserRole) ?? "user", hasRow: true };
}

export function isOpsRole(role: UserRole) {
  return ROLE_ORDER[role] >= ROLE_ORDER.support;
}

export function canSeeOpsNav(role: UserRole) {
  return isOpsRole(role);
}

export function isAdminRole(role: UserRole) {
  return ROLE_ORDER[role] >= ROLE_ORDER.admin;
}

export function canAssignRole(actor: UserRole, target: UserRole) {
  if (actor === "super_admin") return true;
  if (actor === "admin" && target !== "super_admin") return true;
  return false;
}

export async function requireOpsAccess(userId: string, email: string | null | undefined) {
  const roleInfo = await getUserRole(userId);
  if (isOpsRole(roleInfo.role)) return true;
  // Break-glass legacy env override only if no explicit role is set
  if (!roleInfo.hasRow && legacyOpsAdmin(email ?? null)) return true;
  return false;
}
