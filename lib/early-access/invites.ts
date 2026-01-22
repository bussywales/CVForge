import "server-only";

import { randomBytes } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hashEarlyAccessEmail } from "@/lib/early-access";

export type InviteRecord = {
  id: string;
  email_hash: string;
  token: string;
  invited_at: string;
  invited_by_user_id: string | null;
  claimed_at: string | null;
  claimed_user_id: string | null;
  revoked_at: string | null;
  expires_at: string | null;
};

function maskHash(hash: string | null | undefined) {
  if (!hash) return null;
  return hash.slice(0, 8);
}

export function generateInviteToken() {
  return randomBytes(16).toString("hex");
}

export function buildInviteLink(token: string, baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.cvforge.com") {
  const trimmed = baseUrl?.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/signup?invite=${encodeURIComponent(token)}`;
}

export async function findActiveInviteByEmailHash(emailHash: string): Promise<InviteRecord | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("early_access_invites")
    .select("*")
    .eq("email_hash", emailHash)
    .is("revoked_at", null)
    .is("claimed_at", null)
    .order("invited_at", { ascending: false })
    .limit(1);
  return (data?.[0] as InviteRecord | undefined) ?? null;
}

export async function findLatestInviteByEmailHash(emailHash: string): Promise<InviteRecord | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("early_access_invites").select("*").eq("email_hash", emailHash).order("invited_at", { ascending: false }).limit(1);
  return (data?.[0] as InviteRecord | undefined) ?? null;
}

export async function findInviteByToken(token: string): Promise<InviteRecord | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("early_access_invites").select("*").eq("token", token).order("invited_at", { ascending: false }).limit(1);
  return (data?.[0] as InviteRecord | undefined) ?? null;
}

export async function createInvite({
  email,
  invitedBy,
  now = new Date(),
  expiresAt,
}: {
  email: string;
  invitedBy: string;
  now?: Date;
  expiresAt?: Date | null;
}): Promise<{ token: string; invite: InviteRecord }> {
  const admin = createServiceRoleClient();
  const emailHash = hashEarlyAccessEmail(email);
  if (!emailHash) {
    throw new Error("invalid_email_hash");
  }
  const existing = await findActiveInviteByEmailHash(emailHash ?? "");
  if (existing) {
    return { token: existing.token, invite: existing };
  }
  const token = generateInviteToken();
  const payload = {
    email_hash: emailHash,
    token,
    invited_at: now.toISOString(),
    invited_by_user_id: invitedBy,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    revoked_at: null,
    claimed_at: null,
    claimed_user_id: null,
  };
  const { data, error } = await admin.from("early_access_invites").insert(payload).select("*").maybeSingle();
  if (error || !data) throw error;
  return { token, invite: data as InviteRecord };
}

export async function revokeInvite({ emailHash, token, now = new Date() }: { emailHash?: string; token?: string; now?: Date }) {
  const admin = createServiceRoleClient();
  let query = admin.from("early_access_invites").update({ revoked_at: now.toISOString() }).is("claimed_at", null).is("revoked_at", null);
  if (emailHash) {
    query = query.eq("email_hash", emailHash);
  }
  if (token) {
    query = query.eq("token", token);
  }
  await query;
}

export async function listRecentInvites({ limit = 20 }: { limit?: number } = {}) {
  const admin = createServiceRoleClient();
  const capped = Math.min(Math.max(limit, 1), 50);
  const { data } = await admin
    .from("early_access_invites")
    .select("*")
    .order("invited_at", { ascending: false })
    .limit(capped);
  return (data ?? []).map((row: any) => {
    const status = row.revoked_at ? "revoked" : row.claimed_at ? "claimed" : "pending";
    return {
      ...row,
      status,
      email_hash_prefix: maskHash(row.email_hash),
    };
  });
}

export async function claimInviteForUser({ email, userId, now = new Date() }: { email: string; userId: string; now?: Date }) {
  const admin = createServiceRoleClient();
  const emailHash = hashEarlyAccessEmail(email);
  if (!emailHash) return { status: "skipped", reason: "no_email_hash" as const };
  const invite = await findActiveInviteByEmailHash(emailHash);
  if (!invite) return { status: "skipped", reason: "no_invite" as const };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < now.getTime()) {
    await admin.from("early_access_invites").update({ revoked_at: now.toISOString() }).eq("id", invite.id);
    return { status: "skipped", reason: "expired" as const };
  }
  const allowlistPayload = {
    user_id: userId,
    email_hash: emailHash,
    invited_at: invite.invited_at,
    invited_by: invite.invited_by_user_id,
    granted_at: now.toISOString(),
    granted_by: invite.invited_by_user_id,
    revoked_at: null,
    note: null,
    email_domain: null,
  };
  await admin.from("early_access_allowlist").upsert(allowlistPayload, { onConflict: "email_hash" });
  await admin
    .from("early_access_invites")
    .update({ claimed_at: now.toISOString(), claimed_user_id: userId })
    .eq("id", invite.id);
  return { status: "claimed" as const, inviteId: invite.id, email_hash: emailHash };
}
