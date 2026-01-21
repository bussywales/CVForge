import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type ResolutionOutcomeCode =
  | "PORTAL_RETRY_SUCCESS"
  | "WEBHOOK_DELAY_WAITED"
  | "CREDITS_RECONCILED_SUPPORT"
  | "SUBSCRIPTION_REACTIVATED"
  | "USER_GUIDED_SELF_SERVE"
  | "NOT_BILLING_ISSUE"
  | "OTHER";

export type ResolutionOutcome = {
  code: ResolutionOutcomeCode;
  note?: string | null;
  createdAt: string;
  actor: string | null;
  requestId?: string | null;
  userId?: string | null;
};

type OutcomeInput = {
  code: ResolutionOutcomeCode;
  note?: string | null;
  requestId?: string | null;
  userId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
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
  const meta = sanitizeMonetisationMeta({
    code: input.code,
    note: trimmedNote,
    requestId: input.requestId ?? null,
    userId: input.userId ?? null,
    actorId: input.actorId ?? null,
    actor: maskEmail(input.actorEmail) ?? null,
    hasNote: Boolean(trimmedNote),
  });
  return { surface: "ops", meta };
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
    .select("type,body,occurred_at,created_at")
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
  return rows
    .map((row: any) => {
      let meta: any = {};
      try {
        meta = JSON.parse(row.body ?? "{}");
      } catch {
        meta = {};
      }
      const note = typeof meta.note === "string" ? meta.note.slice(0, 200) : undefined;
      return {
        code: meta.code as ResolutionOutcomeCode,
        note,
        createdAt: row.occurred_at ?? row.created_at ?? now.toISOString(),
        actor: meta.actor ?? maskEmail(meta.actorEmail) ?? null,
        requestId: meta.requestId ?? null,
        userId: meta.userId ?? null,
      } as ResolutionOutcome;
    })
    .filter((o) => Boolean(o.code))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
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
    .select("body,occurred_at,created_at")
    .eq("type", "monetisation.ops_resolution_outcome_set")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false });
  if (userId) query = query.like("body", `%${userId}%`);
  if (outcomeCode) query = query.like("body", `%${outcomeCode}%`);
  const { data, error } = await query;
  if (error || !data) {
    return { totals: { count: 0, uniqueUsers: 0, uniqueRequestIds: 0 }, topOutcomes: [], topActors: [], bySurface: [], recent: [] };
  }
  const outcomes = data.map((row: any) => {
    let meta: any = {};
    try {
      meta = JSON.parse(row.body ?? "{}");
    } catch {
      meta = {};
    }
    const noteRaw = typeof meta.note === "string" ? meta.note : "";
    return {
      code: meta.code as ResolutionOutcomeCode,
      noteMasked: noteRaw ? noteRaw.slice(0, 60) : null,
      at: row.occurred_at ?? row.created_at ?? now.toISOString(),
      requestId: meta.requestId ?? null,
      userIdMasked: meta.userId ? `[user:${String(meta.userId).slice(0, 6)}…]` : null,
      actorMasked: meta.actor ?? maskEmail(meta.actorEmail) ?? null,
      surface: meta.surface ?? meta.contextSurface ?? null,
    };
  });
  const totals = {
    count: outcomes.length,
    uniqueUsers: new Set(outcomes.map((o) => o.userIdMasked).filter(Boolean)).size,
    uniqueRequestIds: new Set(outcomes.map((o) => o.requestId).filter(Boolean)).size,
  };
  const topOutcomes = Array.from(
    outcomes.reduce((map, o) => map.set(o.code, (map.get(o.code) ?? 0) + 1), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
  const topActors = Array.from(
    outcomes.reduce((map, o) => map.set(o.actorMasked ?? "unknown", (map.get(o.actorMasked ?? "unknown") ?? 0) + 1), new Map<string, number>())
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
  const recent = outcomes.slice(0, 20);
  return { totals, topOutcomes, topActors, bySurface, recent };
}
