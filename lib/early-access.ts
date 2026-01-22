import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserRole, isOpsRole } from "@/lib/rbac";

type EarlyAccessReason = "ops_bypass" | "db_allowlist" | "env_allowlist" | "blocked";

export type EarlyAccessDecision = {
  allowed: boolean;
  reason: EarlyAccessReason;
  allowlistMeta: { source: "db" | "env" | "ops" | "none"; grantedAt?: string | null; revokedAt?: string | null; note?: string | null };
};

function parseEmails(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function fetchDbEntry(userId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("early_access_allowlist")
    .select("user_id, granted_at, revoked_at, note")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function getEarlyAccessDecision({ userId, email }: { userId: string; email?: string | null }): Promise<EarlyAccessDecision> {
  const mode = (process.env.EARLY_ACCESS_MODE ?? "on").toLowerCase();
  const roleInfo = await getUserRole(userId);
  if (isOpsRole(roleInfo.role)) {
    return { allowed: true, reason: "ops_bypass", allowlistMeta: { source: "ops" } };
  }

  const dbEntry = await fetchDbEntry(userId);
  if (dbEntry) {
    return {
      allowed: true,
      reason: "db_allowlist",
      allowlistMeta: { source: "db", grantedAt: dbEntry.granted_at, revokedAt: dbEntry.revoked_at, note: dbEntry.note ?? null },
    };
  }

  if (mode === "off") {
    return { allowed: true, reason: "env_allowlist", allowlistMeta: { source: "env" } };
  }

  const envList = parseEmails(process.env.EARLY_ACCESS_EMAILS);
  if (email && envList.includes(email.toLowerCase())) {
    return { allowed: true, reason: "env_allowlist", allowlistMeta: { source: "env" } };
  }

  return { allowed: false, reason: "blocked", allowlistMeta: { source: "none" } };
}

export async function getEarlyAccessRecord(userId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("early_access_allowlist").select("user_id, granted_at, revoked_at, note").eq("user_id", userId).order("granted_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function grantEarlyAccess({ userId, grantedBy, note, now = new Date() }: { userId: string; grantedBy: string; note?: string | null; now?: Date }) {
  const admin = createServiceRoleClient();
  const payload = {
    user_id: userId,
    granted_by: grantedBy,
    granted_at: now.toISOString(),
    revoked_at: null,
    note: note?.slice(0, 280) ?? null,
  };
  const { error } = await admin.from("early_access_allowlist").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
  return payload;
}

export async function revokeEarlyAccess({ userId, note, now = new Date() }: { userId: string; note?: string | null; now?: Date }) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("early_access_allowlist").select("user_id, revoked_at").eq("user_id", userId).maybeSingle();
  if (!data) {
    return { status: "noop" as const };
  }
  if (data.revoked_at) {
    return { status: "already_revoked" as const };
  }
  const { error } = await admin
    .from("early_access_allowlist")
    .update({ revoked_at: now.toISOString(), note: note?.slice(0, 280) ?? null })
    .eq("user_id", userId);
  if (error) throw error;
  return { status: "revoked" as const, revokedAt: now.toISOString() };
}
