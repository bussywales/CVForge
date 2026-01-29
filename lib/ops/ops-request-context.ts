import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { logMonetisationEvent } from "@/lib/monetisation";
import { buildCaseRange, type CaseWindow, resolveCaseWindow } from "@/lib/ops/ops-case-model";

export type OpsRequestContextRow = {
  request_id: string;
  user_id: string | null;
  email_masked: string | null;
  source: string | null;
  confidence: RequestContextConfidence | null;
  evidence: Record<string, any>;
  sources: string[];
  first_seen_at: string;
  last_seen_at: string;
  last_seen_path: string | null;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type RequestContextConfidence = "high" | "medium";

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
  evidence?: Record<string, any>;
  confidence?: RequestContextConfidence | null;
  now?: Date;
};

export async function upsertRequestContext({
  requestId,
  userId,
  email,
  source,
  path,
  meta,
  evidence,
  confidence,
  now,
}: UpsertInput): Promise<OpsRequestContextRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const nowIso = (now ?? new Date()).toISOString();
  const safeMeta = sanitizeMonetisationMeta(meta ?? {});
  const safeEvidence = sanitizeMonetisationMeta(evidence ?? {});
  const emailMasked = email ? maskEmail(email) : null;
  const requestedConfidence: RequestContextConfidence | null =
    confidence === "high" || confidence === "medium" ? confidence : null;
  const nextConfidence: RequestContextConfidence | null = requestedConfidence ?? (userId ? "high" : null);

  const { data: existing, error } = await admin
    .from("ops_request_context")
    .select(
      "request_id, user_id, email_masked, source, confidence, evidence, sources, first_seen_at, last_seen_at, last_seen_path, meta, created_at, updated_at"
    )
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;

  if (!existing) {
    const insertPayload = {
      request_id: requestId,
      user_id: userId ?? null,
      email_masked: emailMasked,
      source,
      confidence: nextConfidence,
      evidence: safeEvidence,
      sources: [source],
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      last_seen_path: path ?? null,
      meta: safeMeta,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const { data: created, error: insertError } = await admin
      .from("ops_request_context")
      .insert(insertPayload)
      .select(
        "request_id, user_id, email_masked, source, confidence, evidence, sources, first_seen_at, last_seen_at, last_seen_path, meta, created_at, updated_at"
      )
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

  const mergedEvidence: Record<string, any> = { ...(existing.evidence ?? {}) };
  for (const [key, value] of Object.entries(safeEvidence)) {
    if (mergedEvidence[key] === undefined || mergedEvidence[key] === null) {
      mergedEvidence[key] = value;
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
  const currentConfidence = existing.confidence as RequestContextConfidence | null;
  let resolvedConfidence = currentConfidence ?? null;
  if (!resolvedConfidence && nextConfidence) {
    resolvedConfidence = nextConfidence;
  } else if (resolvedConfidence === "medium" && nextConfidence === "high") {
    resolvedConfidence = "high";
  }

  const { data: updated, error: updateError } = await admin
    .from("ops_request_context")
    .update({
      user_id: nextUserId,
      email_masked: nextEmailMasked,
      source,
      confidence: resolvedConfidence,
      evidence: mergedEvidence,
      sources: nextSources,
      last_seen_at: nowIso,
      last_seen_path: path ?? existing.last_seen_path ?? null,
      meta: mergedMeta,
      updated_at: nowIso,
    })
    .eq("request_id", requestId)
    .select(
      "request_id, user_id, email_masked, source, confidence, evidence, sources, first_seen_at, last_seen_at, last_seen_path, meta, created_at, updated_at"
    )
    .single();
  if (updateError) throw updateError;
  return updated as OpsRequestContextRow;
}

export async function getRequestContext(requestId: string): Promise<OpsRequestContextRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_request_context")
    .select(
      "request_id, user_id, email_masked, source, confidence, evidence, sources, first_seen_at, last_seen_at, last_seen_path, meta, created_at, updated_at"
    )
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as OpsRequestContextRow | null) ?? null;
}

type ResolveInput = {
  requestId: string;
  window?: CaseWindow | string | null;
  now?: Date;
  actorUserId?: string | null;
};

type TouchpointMatch = {
  userId: string;
  source: string;
  confidence: RequestContextConfidence;
  evidence: Record<string, any>;
  path?: string | null;
};

async function findAuditTouchpoint({
  admin,
  requestId,
  fromIso,
}: {
  admin: ReturnType<typeof createServiceRoleClient>;
  requestId: string;
  fromIso: string;
}): Promise<TouchpointMatch | null> {
  const { data } = await admin
    .from("ops_audit_log")
    .select("id,created_at,target_user_id,meta,action")
    .gte("created_at", fromIso)
    .or(`meta->>requestId.eq.${requestId},meta->>req.eq.${requestId}`)
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  for (const row of rows) {
    const meta = (row as any)?.meta ?? {};
    const targetUserId = (row as any)?.target_user_id ?? null;
    const metaUserId = typeof meta.userId === "string" ? meta.userId : null;
    const userId = targetUserId ?? metaUserId;
    if (!userId) continue;
    return {
      userId,
      source: "ops_audit",
      confidence: targetUserId ? "high" : "medium",
      evidence: sanitizeMonetisationMeta({ action: row.action ?? null, auditId: row.id ?? null }),
      path: typeof meta.path === "string" ? meta.path : null,
    };
  }
  return null;
}

async function findOutcomeTouchpoint({
  admin,
  requestId,
  fromIso,
}: {
  admin: ReturnType<typeof createServiceRoleClient>;
  requestId: string;
  fromIso: string;
}): Promise<TouchpointMatch | null> {
  const { data } = await admin
    .from("application_activities")
    .select("id,body,occurred_at,created_at")
    .eq("type", "monetisation.ops_resolution_outcome_set")
    .gte("occurred_at", fromIso)
    .like("body", `%${requestId}%`)
    .order("occurred_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  for (const row of rows) {
    let meta: any = {};
    try {
      meta = JSON.parse(row.body ?? "{}");
    } catch {
      meta = {};
    }
    const matchRequestId = meta.requestId ?? meta.req ?? null;
    if (matchRequestId !== requestId) continue;
    const userId = typeof meta.userId === "string" ? meta.userId : null;
    if (!userId) continue;
    return {
      userId,
      source: "ops_outcome",
      confidence: "high",
      evidence: sanitizeMonetisationMeta({ outcomeId: row.id ?? null, code: meta.code ?? null }),
      path: null,
    };
  }
  return null;
}

async function findWebhookTouchpoint({
  admin,
  requestId,
  fromIso,
}: {
  admin: ReturnType<typeof createServiceRoleClient>;
  requestId: string;
  fromIso: string;
}): Promise<TouchpointMatch | null> {
  const { data } = await admin
    .from("application_activities")
    .select("id,user_id,body,occurred_at,created_at,type")
    .or("type.ilike.monetisation.webhook_error%,type.ilike.monetisation.webhook_failure%")
    .gte("occurred_at", fromIso)
    .like("body", `%${requestId}%`)
    .order("occurred_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  for (const row of rows) {
    let meta: any = {};
    try {
      meta = JSON.parse(row.body ?? "{}");
    } catch {
      meta = {};
    }
    const matchRequestId = meta.requestId ?? meta.req ?? meta.request_id ?? null;
    if (matchRequestId !== requestId) continue;
    const userId = row.user_id ?? (typeof meta.userId === "string" ? meta.userId : null);
    if (!userId) continue;
    return {
      userId,
      source: "webhook_failure",
      confidence: "high",
      evidence: sanitizeMonetisationMeta({ activityId: row.id ?? null, type: row.type ?? null, code: meta.code ?? null }),
      path: null,
    };
  }
  return null;
}

export async function resolveRequestContext({
  requestId,
  window,
  now = new Date(),
  actorUserId,
}: ResolveInput): Promise<OpsRequestContextRow | null> {
  if (!requestId) return null;
  const existing = await getRequestContext(requestId);
  if (existing?.user_id) return existing;

  const admin = createServiceRoleClient();
  const windowLabel = resolveCaseWindow(window ?? null);
  const { fromIso } = buildCaseRange({ window: windowLabel, now });

  const auditMatch = await findAuditTouchpoint({ admin, requestId, fromIso });
  if (auditMatch) {
    const resolved = await upsertRequestContext({
      requestId,
      userId: auditMatch.userId,
      source: auditMatch.source,
      confidence: auditMatch.confidence,
      evidence: auditMatch.evidence,
      path: auditMatch.path ?? null,
      meta: { resolver: "ops_case_context" },
      now,
    });
    try {
      if (actorUserId) {
        await logMonetisationEvent(admin as any, actorUserId, "ops_case_context_upsert", {
          meta: { source: auditMatch.source, confidence: auditMatch.confidence },
        });
      }
    } catch {
      // ignore
    }
    return resolved;
  }

  const outcomeMatch = await findOutcomeTouchpoint({ admin, requestId, fromIso });
  if (outcomeMatch) {
    const resolved = await upsertRequestContext({
      requestId,
      userId: outcomeMatch.userId,
      source: outcomeMatch.source,
      confidence: outcomeMatch.confidence,
      evidence: outcomeMatch.evidence,
      path: outcomeMatch.path ?? null,
      meta: { resolver: "ops_case_context" },
      now,
    });
    try {
      if (actorUserId) {
        await logMonetisationEvent(admin as any, actorUserId, "ops_case_context_upsert", {
          meta: { source: outcomeMatch.source, confidence: outcomeMatch.confidence },
        });
      }
    } catch {
      // ignore
    }
    return resolved;
  }

  const webhookMatch = await findWebhookTouchpoint({ admin, requestId, fromIso });
  if (webhookMatch) {
    const resolved = await upsertRequestContext({
      requestId,
      userId: webhookMatch.userId,
      source: webhookMatch.source,
      confidence: webhookMatch.confidence,
      evidence: webhookMatch.evidence,
      path: webhookMatch.path ?? null,
      meta: { resolver: "ops_case_context" },
      now,
    });
    try {
      if (actorUserId) {
        await logMonetisationEvent(admin as any, actorUserId, "ops_case_context_upsert", {
          meta: { source: webhookMatch.source, confidence: webhookMatch.confidence },
        });
      }
    } catch {
      // ignore
    }
    return resolved;
  }

  return existing ?? null;
}
