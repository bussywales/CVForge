import "server-only";

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserRole, isOpsRole } from "@/lib/rbac";

type EarlyAccessSource = "ops" | "db_user" | "db_email" | "env" | "blocked";

export type EarlyAccessDecision = {
  allowed: boolean;
  source: EarlyAccessSource;
  allowlistMeta: { source: "db" | "env" | "ops" | "none"; grantedAt?: string | null; revokedAt?: string | null; note?: string | null };
};

export function hashEarlyAccessEmail(email: string | null | undefined) {
  if (!email) return null;
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

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

async function fetchDbEntryByEmailHash(emailHash: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("early_access_allowlist")
    .select("user_id, granted_at, revoked_at, note, invited_at")
    .eq("email_hash", emailHash)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function getEarlyAccessDecision({ userId, email }: { userId: string; email?: string | null }): Promise<EarlyAccessDecision> {
  const mode = (process.env.EARLY_ACCESS_MODE ?? "on").toLowerCase();
  const roleInfo = await getUserRole(userId);
  const emailHash = hashEarlyAccessEmail(email);
  let decision: EarlyAccessDecision | null = null;
  if (isOpsRole(roleInfo.role)) {
    decision = { allowed: true, source: "ops", allowlistMeta: { source: "ops" } };
  }
  const dbEntryByUser = await fetchDbEntry(userId);
  if (!decision && dbEntryByUser) {
    decision = {
      allowed: true,
      source: "db_user",
      allowlistMeta: { source: "db", grantedAt: dbEntryByUser.granted_at, revokedAt: dbEntryByUser.revoked_at, note: dbEntryByUser.note ?? null },
    };
  }

  if (!decision && emailHash) {
    const dbEntryByEmail = await fetchDbEntryByEmailHash(emailHash);
    if (dbEntryByEmail) {
      decision = {
        allowed: true,
        source: "db_email",
        allowlistMeta: { source: "db", grantedAt: dbEntryByEmail.granted_at ?? dbEntryByEmail.invited_at, revokedAt: dbEntryByEmail.revoked_at, note: dbEntryByEmail.note ?? null },
      };
    }
  }

  if (!decision && mode === "off") {
    decision = { allowed: true, source: "env", allowlistMeta: { source: "env" } };
  }

  if (!decision) {
    const envList = parseEmails(process.env.EARLY_ACCESS_EMAILS);
    if (email && envList.includes(email.toLowerCase())) {
      decision = { allowed: true, source: "env", allowlistMeta: { source: "env" } };
    }
  }

  const finalDecision: EarlyAccessDecision = decision ?? { allowed: false, source: "blocked", allowlistMeta: { source: "none" } };
  try {
    const admin = createServiceRoleClient();
    await admin.from("ops_audit_log").insert({
      actor_user_id: userId,
      target_user_id: userId,
      action: "early_access_gate",
      meta: { source: finalDecision.source, allowed: finalDecision.allowed, hashedEmail: emailHash ? `hash:${emailHash}` : null },
    });
  } catch {
    // ignore
  }
  return finalDecision;
}

export async function getEarlyAccessRecord(userId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("early_access_allowlist").select("user_id, granted_at, revoked_at, note").eq("user_id", userId).order("granted_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function grantEarlyAccess({
  userId,
  email,
  grantedBy,
  note,
  now = new Date(),
}: {
  userId?: string | null;
  email: string;
  grantedBy: string;
  note?: string | null;
  now?: Date;
}) {
  const admin = createServiceRoleClient();
  const hashed = hashEarlyAccessEmail(email);
  const emailDomain = email.includes("@") ? email.split("@")[1] ?? null : null;
  const payload = {
    user_id: userId ?? null,
    email_hash: hashed,
    email_domain: emailDomain ? emailDomain.split(".").slice(-2).join(".") : null,
    granted_by: grantedBy,
    invited_by: grantedBy,
    invited_at: now.toISOString(),
    granted_at: now.toISOString(),
    revoked_at: null,
    note: note?.slice(0, 120) ?? null,
  };
  const { error } = await admin.from("early_access_allowlist").upsert(payload, { onConflict: "email_hash" });
  if (error) throw error;
  return payload;
}

export async function revokeEarlyAccess({ userId, email, note, now = new Date() }: { userId?: string | null; email?: string | null; note?: string | null; now?: Date }) {
  const admin = createServiceRoleClient();
  const hashed = hashEarlyAccessEmail(email ?? null);
  let query = admin.from("early_access_allowlist").select("user_id, revoked_at, email_hash").is("revoked_at", null);
  if (userId) query = query.eq("user_id", userId);
  if (hashed) query = query.eq("email_hash", hashed);
  const { data } = await query.maybeSingle();
  if (!data && !hashed) {
    return { status: "noop" as const };
  }
  if (data?.revoked_at) {
    return { status: "already_revoked" as const };
  }
  const { error } = await admin
    .from("early_access_allowlist")
    .update({ revoked_at: now.toISOString(), note: note?.slice(0, 120) ?? null })
    .match({
      ...(hashed ? { email_hash: hashed } : {}),
      ...(userId ? { user_id: userId } : {}),
      revoked_at: null,
    });
  if (error) throw error;
  return { status: "revoked" as const, revokedAt: now.toISOString() };
}
