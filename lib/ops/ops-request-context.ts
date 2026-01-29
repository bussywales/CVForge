import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type OpsRequestContextRow = {
  request_id: string;
  user_id: string | null;
  email_masked: string | null;
  sources: string[];
  first_seen_at: string;
  last_seen_at: string;
  last_seen_path: string | null;
  meta: Record<string, any>;
};

export function maskEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return "";
  const [local, domain] = trimmed.split("@");
  if (!domain) return `${local.slice(0, 1) ?? ""}***`;
  const safeLocal = local.length <= 2 ? `${local[0] ?? "*"}***` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => {
      if (!part) return "";
      if (idx === domainParts.length - 1) return part;
      const head = part.slice(0, 1);
      return `${head}${"*".repeat(Math.max(0, part.length - 1))}`;
    })
    .join(".");
  return `${safeLocal}@${maskedDomain}`;
}

export function isLikelyRequestId(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("req_");
}

type UpsertInput = {
  requestId: string;
  userId?: string | null;
  email?: string | null;
  source: string;
  path?: string | null;
  meta?: Record<string, any>;
  now?: Date;
};

export async function upsertRequestContext({
  requestId,
  userId,
  email,
  source,
  path,
  meta,
  now,
}: UpsertInput): Promise<OpsRequestContextRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const nowIso = (now ?? new Date()).toISOString();
  const safeMeta = sanitizeMonetisationMeta(meta ?? {});
  const emailMasked = email ? maskEmail(email) : null;

  const { data: existing, error } = await admin
    .from("ops_request_context")
    .select("request_id, user_id, email_masked, sources, first_seen_at, last_seen_at, last_seen_path, meta")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;

  if (!existing) {
    const insertPayload = {
      request_id: requestId,
      user_id: userId ?? null,
      email_masked: emailMasked,
      sources: [source],
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      last_seen_path: path ?? null,
      meta: safeMeta,
    };
    const { data: created, error: insertError } = await admin
      .from("ops_request_context")
      .insert(insertPayload)
      .select("request_id, user_id, email_masked, sources, first_seen_at, last_seen_at, last_seen_path, meta")
      .single();
    if (insertError) throw insertError;
    return created as OpsRequestContextRow;
  }

  const nextSources = Array.from(new Set([...(existing.sources ?? []), source]));
  const mergedMeta: Record<string, any> = { ...(existing.meta ?? {}) };
  for (const [key, value] of Object.entries(safeMeta)) {
    if (mergedMeta[key] === undefined || mergedMeta[key] === null) {
      mergedMeta[key] = value;
    }
  }

  let nextUserId: string | null = existing.user_id ?? null;
  if (!nextUserId && userId) {
    nextUserId = userId;
  } else if (nextUserId && userId && nextUserId !== userId) {
    // Keep the original user_id to avoid conflicting identities.
    console.warn("[ops_request_context] user_id conflict", { requestId });
    mergedMeta.conflict_user_id = "[ignored]";
  }

  const nextEmailMasked = existing.email_masked ?? emailMasked ?? null;

  const { data: updated, error: updateError } = await admin
    .from("ops_request_context")
    .update({
      user_id: nextUserId,
      email_masked: nextEmailMasked,
      sources: nextSources,
      last_seen_at: nowIso,
      last_seen_path: path ?? existing.last_seen_path ?? null,
      meta: mergedMeta,
    })
    .eq("request_id", requestId)
    .select("request_id, user_id, email_masked, sources, first_seen_at, last_seen_at, last_seen_path, meta")
    .single();
  if (updateError) throw updateError;
  return updated as OpsRequestContextRow;
}

export async function getRequestContext(requestId: string): Promise<OpsRequestContextRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_request_context")
    .select("request_id, user_id, email_masked, sources, first_seen_at, last_seen_at, last_seen_path, meta")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as OpsRequestContextRow | null) ?? null;
}
