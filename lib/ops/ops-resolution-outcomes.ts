import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type EffectivenessState = "unknown" | "success" | "fail";

export type ResolutionOutcomeCode =
  | "PORTAL_RETRY_SUCCESS"
  | "WEBHOOK_DELAY_WAITED"
  | "CREDITS_RECONCILED_SUPPORT"
  | "SUBSCRIPTION_REACTIVATED"
  | "USER_GUIDED_SELF_SERVE"
  | "NOT_BILLING_ISSUE"
  | "OTHER"
  | "alert_handled";

export type ResolutionOutcome = {
  id?: string;
  code: ResolutionOutcomeCode;
  note?: string | null;
  createdAt: string;
  actor: string | null;
  requestId?: string | null;
  userId?: string | null;
  surface?: string | null;
  effectivenessState?: EffectivenessState;
  effectivenessReason?: string | null;
  effectivenessNote?: string | null;
  effectivenessSource?: string | null;
  effectivenessUpdatedAt?: string | null;
  effectivenessDeferredUntil?: string | null;
  alertKey?: string | null;
  alertSignal?: string | null;
  alertSurface?: string | null;
  alertCode?: string | null;
  alertWindow?: string | null;
};

type OutcomeInput = {
  code: ResolutionOutcomeCode;
  note?: string | null;
  requestId?: string | null;
  userId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  meta?: Record<string, any> | null;
};

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

export function buildOutcomeEvent(input: OutcomeInput) {
  const trimmedNote =
    typeof input.note === "string" && input.note.length > 0 ? input.note.slice(0, 200) : undefined;
  const nowIso = new Date().toISOString();
  const baseMeta = sanitizeMonetisationMeta({
    code: input.code,
    note: trimmedNote,
    requestId: input.requestId ?? null,
    userId: input.userId ?? null,
    actorId: input.actorId ?? null,
    actor: maskEmail(input.actorEmail) ?? null,
    hasNote: Boolean(trimmedNote),
    effectivenessState: "unknown" as EffectivenessState,
    effectivenessUpdatedAt: nowIso,
    effectivenessDeferredUntil: null,
    effectivenessSource: "ops_resolution_outcome",
  });
  const extraMeta = sanitizeMonetisationMeta(input.meta ?? {});
  const meta = { ...baseMeta, ...extraMeta };
  return { surface: "ops", meta };
}

function sanitizeEffectiveness(meta: Record<string, any>) {
  const cleaned = sanitizeMonetisationMeta({
    effectivenessState: meta.effectivenessState ?? meta.state ?? "unknown",
    effectivenessReason: meta.effectivenessReason ?? meta.reason ?? null,
    effectivenessNote: meta.effectivenessNote ?? meta.effectiveNote ?? null,
    effectivenessSource: meta.effectivenessSource ?? meta.source ?? null,
    effectivenessUpdatedAt: meta.effectivenessUpdatedAt ?? meta.updatedAt ?? null,
    effectivenessDeferredUntil: meta.effectivenessDeferredUntil ?? meta.deferredUntil ?? null,
  });
  const stateRaw = cleaned.effectivenessState ?? meta.effectivenessState ?? "unknown";
  const state: EffectivenessState = stateRaw === "success" || stateRaw === "fail" ? stateRaw : "unknown";
  return {
    effectivenessState: state,
    effectivenessReason: typeof cleaned.effectivenessReason === "string" ? cleaned.effectivenessReason : null,
    effectivenessNote: typeof cleaned.effectivenessNote === "string" ? cleaned.effectivenessNote : null,
    effectivenessSource: typeof cleaned.effectivenessSource === "string" ? cleaned.effectivenessSource : null,
    effectivenessUpdatedAt:
      typeof cleaned.effectivenessUpdatedAt === "string"
        ? cleaned.effectivenessUpdatedAt
        : typeof meta.effectivenessUpdatedAt === "string"
          ? meta.effectivenessUpdatedAt
          : null,
    effectivenessDeferredUntil:
      typeof cleaned.effectivenessDeferredUntil === "string"
        ? cleaned.effectivenessDeferredUntil
        : typeof meta.effectivenessDeferredUntil === "string"
          ? meta.effectivenessDeferredUntil
          : null,
  };
}

function parseOutcomeRow(row: any, now: Date): ResolutionOutcome | null {
  let meta: any = {};
  try {
    meta = JSON.parse(row.body ?? "{}");
  } catch {
    meta = {};
  }
  const note = typeof meta.note === "string" ? meta.note.slice(0, 200) : undefined;
  const createdAt = row.occurred_at ?? row.created_at ?? now.toISOString();
  const effectiveness = sanitizeEffectiveness(meta);
  const alertKey = typeof meta.alertKey === "string" ? meta.alertKey : null;
  const alertSignal = typeof meta.signal === "string" ? meta.signal : typeof meta.alertSignal === "string" ? meta.alertSignal : null;
  const alertSurface = typeof meta.surface === "string" ? meta.surface : typeof meta.alertSurface === "string" ? meta.alertSurface : null;
  const alertCode = typeof meta.code === "string" ? meta.code : typeof meta.alertCode === "string" ? meta.alertCode : null;
  const alertWindow =
    typeof meta.window_label === "string"
      ? meta.window_label
      : typeof meta.alertWindow === "string"
        ? meta.alertWindow
        : null;
  return {
    id: row.id ?? undefined,
    code: meta.code as ResolutionOutcomeCode,
    note,
    createdAt,
    actor: meta.actor ?? maskEmail(meta.actorEmail) ?? null,
    requestId: meta.requestId ?? null,
    userId: meta.userId ?? null,
    surface: meta.surface ?? meta.contextSurface ?? null,
    ...effectiveness,
    alertKey,
    alertSignal,
    alertSurface,
    alertCode,
    alertWindow,
  };
}

export function mapOutcomeRows(rows: any[], now = new Date()): ResolutionOutcome[] {
  return rows
    .map((row) => parseOutcomeRow(row, now))
    .filter((o): o is ResolutionOutcome => Boolean(o && o.code))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function maskResolutionOutcome(outcome: ResolutionOutcome) {
  return {
    id: outcome.id ?? null,
    code: outcome.code,
    createdAt: outcome.createdAt,
    requestId: outcome.requestId ?? null,
    userId: outcome.userId ?? null,
    userIdMasked: outcome.userId ? `[user:${String(outcome.userId).slice(0, 6)}…]` : null,
    actorMasked: outcome.actor ?? null,
    noteMasked: outcome.note ? outcome.note.slice(0, 120) : null,
    effectivenessState: outcome.effectivenessState ?? "unknown",
    effectivenessReason: outcome.effectivenessReason ?? null,
    effectivenessNote: outcome.effectivenessNote ?? null,
    effectivenessSource: outcome.effectivenessSource ?? null,
    effectivenessUpdatedAt: outcome.effectivenessUpdatedAt ?? null,
    effectivenessDeferredUntil: outcome.effectivenessDeferredUntil ?? null,
  };
}

export async function listRecentOutcomes({
  userId,
  requestId,
  limit = 3,
  now = new Date(),
  client,
}: {
  userId?: string | null;
  requestId?: string | null;
  limit?: number;
  now?: Date;
  client?: ReturnType<typeof createServiceRoleClient>;
}): Promise<ResolutionOutcome[]> {
  const admin = client ?? createServiceRoleClient();
  const since = new Date(now);
  since.setMonth(since.getMonth() - 3);
  let query = admin
    .from("application_activities")
    .select("id,type,body,occurred_at,created_at")
    .eq("type", "monetisation.ops_resolution_outcome_set")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(limit * 3);

  if (requestId) {
    query = query.like("body", `%${requestId}%`);
  } else if (userId) {
    query = query.like("body", `%${userId}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data.slice(0, limit);
  return mapOutcomeRows(rows, now).slice(0, limit);
}

export async function summariseResolutionOutcomes({
  windowHours = 24,
  userId,
  outcomeCode,
  now = new Date(),
  client,
}: {
  windowHours?: number;
  userId?: string | null;
  outcomeCode?: ResolutionOutcomeCode | null;
  now?: Date;
  client?: ReturnType<typeof createServiceRoleClient>;
}) {
  const admin = client ?? createServiceRoleClient();
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  let query = admin
    .from("application_activities")
    .select("id,body,occurred_at,created_at")
    .eq("type", "monetisation.ops_resolution_outcome_set")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false });
  if (userId) query = query.like("body", `%${userId}%`);
  if (outcomeCode) query = query.like("body", `%${outcomeCode}%`);
  const { data, error } = await query;
  if (error || !data) {
    return { totals: { count: 0, uniqueUsers: 0, uniqueRequestIds: 0 }, topOutcomes: [], topActors: [], bySurface: [], recent: [] };
  }
  const outcomes = mapOutcomeRows(data, now);
  const totals = {
    count: outcomes.length,
    uniqueUsers: new Set(outcomes.map((o) => o.userId).filter(Boolean)).size,
    uniqueRequestIds: new Set(outcomes.map((o) => o.requestId).filter(Boolean)).size,
  };
  const topOutcomes = Array.from(
    outcomes.reduce((map, o) => map.set(o.code, (map.get(o.code) ?? 0) + 1), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
  const topActors = Array.from(
    outcomes.reduce((map, o) => map.set(o.actor ?? "unknown", (map.get(o.actor ?? "unknown") ?? 0) + 1), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([actorMasked, count]) => ({ actorMasked, count }));
  const bySurface = Array.from(
    outcomes.reduce((map, o) => {
      if (!o.surface) return map;
      return map.set(o.surface, (map.get(o.surface) ?? 0) + 1);
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([surface, count]) => ({ surface, count }));
  const recent = outcomes.slice(0, 20).map((o) => ({
    at: o.createdAt,
    code: o.code,
    requestId: o.requestId ?? null,
    userIdMasked: o.userId ? `[user:${String(o.userId).slice(0, 6)}…]` : null,
    actorMasked: o.actor ?? null,
    noteMasked: o.note ? o.note.slice(0, 60) : null,
  }));
  return { totals, topOutcomes, topActors, bySurface, recent };
}
