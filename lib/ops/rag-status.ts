import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import { getRateLimitLog } from "@/lib/rate-limit";
import { buildOpsIncidentsLink, buildOpsWebhooksLink } from "@/lib/ops/ops-links";

type RagState = "green" | "amber" | "red";

export type RagSignal = {
  key: SignalKey;
  label: string;
  severity: RagState;
  count: number;
  topCodes?: Array<{ code: string; count: number }>;
  topSurfaces?: Array<{ surface: string; count: number }>;
  firstSeenAt?: string | null;
};

export type RagTrendBucket = { at: string; green: number; amber: number; red: number; score: number; topSignalKey?: SignalKey | null };

export type RagStatus = {
  rulesVersion: "rag_v2_15m_trend";
  window: { minutes: number; fromIso: string; toIso: string };
  status: RagState;
  overall: RagState;
  headline: string;
  signals: RagSignal[];
  topIssues: Array<{ key: SignalKey; label: string; severity: RagState; count: number; primaryAction: string; secondaryAction?: string | null }>;
  trend: { bucketMinutes: number; fromIso: string; toIso: string; buckets: RagTrendBucket[]; direction: "improving" | "stable" | "worsening" };
  topRepeats: {
    requestIds: Array<{ id: string; count: number }>;
    codes: Array<{ code: string; count: number }>;
    surfaces: Array<{ surface: string; count: number }>;
  };
  updatedAt: string;
};

type SignalKey = "webhook_failures" | "webhook_errors" | "portal_errors" | "checkout_errors" | "rate_limits";
type SignalEvent = { key: SignalKey; atMs: number; code?: string | null; surface?: string | null; requestId?: string | null };

function sanitizeToken(value?: string | null) {
  if (!value) return "unknown";
  const lower = value.toString().toLowerCase();
  if (lower.startsWith("http")) return "[masked]";
  if (value.includes("@")) return "[masked]";
  return value;
}

const SIGNAL_META: Record<
  SignalKey,
  {
    label: string;
    red: number;
    amberMin: number;
    primary: () => string;
    secondary?: () => string | null;
  }
> = {
  webhook_failures: {
    label: "Webhook failures",
    red: 5,
    amberMin: 1,
    primary: () => buildOpsWebhooksLink({ window: "15m", signal: "webhook_failures" }),
    secondary: () => buildOpsIncidentsLink({ window: "15m", surface: "webhook", signal: "webhook_failures" }),
  },
  webhook_errors: {
    label: "Webhook errors",
    red: 5,
    amberMin: 1,
    primary: () => buildOpsIncidentsLink({ window: "15m", surface: "webhook", signal: "webhook_errors" }),
    secondary: () => buildOpsWebhooksLink({ window: "15m", signal: "webhook_errors" }),
  },
  portal_errors: {
    label: "Portal errors",
    red: 10,
    amberMin: 3,
    primary: () => buildOpsIncidentsLink({ window: "15m", surface: "portal", signal: "portal_errors" }),
  },
  checkout_errors: {
    label: "Checkout errors",
    red: 5,
    amberMin: 1,
    primary: () => buildOpsIncidentsLink({ window: "15m", surface: "checkout", signal: "checkout_errors" }),
  },
  rate_limits: {
    label: "Rate limits",
    red: Number.MAX_SAFE_INTEGER,
    amberMin: 5,
    primary: () => "/app/ops/status#limits",
    secondary: () => buildOpsIncidentsLink({ window: "15m", surface: "billing", signal: "rate_limits", code: "RATE_LIMIT" }),
  },
};

function classify(count: number, meta: { red: number; amberMin: number }): RagState {
  if (count >= meta.red) return "red";
  if (count >= meta.amberMin) return "amber";
  return "green";
}

function summariseCodes(events: SignalEvent[]) {
  const counts = events.reduce((map, ev) => {
    const key = sanitizeToken(ev.code);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => ({ code, count }));
}

function summariseSurfaces(events: SignalEvent[]) {
  const counts = events.reduce((map, ev) => {
    const surface = sanitizeToken(ev.surface);
    map.set(surface, (map.get(surface) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([surface, count]) => ({ surface, count }))
    .slice(0, 3);
}

function buildTopRepeats(events: SignalEvent[], windowFromMs: number, windowToMs: number) {
  const windowEvents = events.filter((e) => e.atMs >= windowFromMs && e.atMs <= windowToMs);
  const requestCounts = windowEvents
    .filter((e) => e.requestId)
    .reduce((map, ev) => {
      const id = sanitizeToken(ev.requestId);
      map.set(id, (map.get(id) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
  const codes = summariseCodes(windowEvents);
  const surfaces = summariseSurfaces(windowEvents);
  const topRequestIds = Array.from(requestCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }));
  return { requestIds: topRequestIds, codes, surfaces };
}

function buildHeadline(status: RagState, issues: RagStatus["topIssues"]) {
  if (status === "green") return "All clear";
  const top = issues[0];
  if (!top) return status === "red" ? "Action needed" : "Watching";
  return `${top.label} (${top.count}) in last 15m`;
}

function computeScore(state: RagState, totalCount: number) {
  const base = state === "green" ? 100 : state === "amber" ? 65 : 30;
  const penalty = Math.min(30, Math.round(Math.log1p(totalCount) * 5));
  return Math.max(0, base - penalty);
}

function deriveDirection(buckets: RagTrendBucket[]): "improving" | "stable" | "worsening" {
  if (buckets.length < 8) return "stable";
  const avg = (list: number[]) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
  const last = avg(buckets.slice(-4).map((b) => b.score));
  const prev = avg(buckets.slice(-8, -4).map((b) => b.score));
  const delta = last - prev;
  if (delta > 5) return "improving";
  if (delta < -5) return "worsening";
  return "stable";
}

function mapEventsToSignals(events: SignalEvent[], windowFromMs: number, windowToMs: number) {
  return Object.entries(SIGNAL_META).map(([key, meta]) => {
    const evs = events.filter((ev) => ev.key === key);
    const windowEvents = evs.filter((ev) => ev.atMs >= windowFromMs && ev.atMs <= windowToMs);
    const severity = classify(windowEvents.length, meta);
    const topCodes = summariseCodes(evs);
    const topSurfaces = summariseSurfaces(evs);
    const firstSeenAt = evs.length > 0 ? new Date(Math.min(...evs.map((e) => e.atMs))).toISOString() : null;
    return {
      key: key as SignalKey,
      label: meta.label,
      severity,
      count: windowEvents.length,
      topCodes,
      topSurfaces,
      firstSeenAt,
    } as RagSignal;
  });
}

function deriveTopIssues(signals: RagSignal[]) {
  return signals
    .filter((s) => s.severity !== "green" || s.count > 0)
    .sort((a, b) => {
      if (a.severity === b.severity) return b.count - a.count;
      if (a.severity === "red") return -1;
      if (b.severity === "red") return 1;
      return a.severity === "amber" ? -1 : 1;
    })
    .slice(0, 3)
    .map((s) => ({
      key: s.key,
      label: s.label,
      severity: s.severity,
      count: s.count,
      primaryAction: SIGNAL_META[s.key].primary(),
      secondaryAction: SIGNAL_META[s.key].secondary ? SIGNAL_META[s.key].secondary!() : null,
    }));
}

function computeTrend(
  events: SignalEvent[],
  { now, bucketMinutes, hours }: { now: Date; bucketMinutes: number; hours: number }
): { bucketMinutes: number; fromIso: string; toIso: string; buckets: RagTrendBucket[]; direction: "improving" | "stable" | "worsening" } {
  const bucketMs = bucketMinutes * 60 * 1000;
  const totalBuckets = Math.ceil((hours * 60) / bucketMinutes);
  const fromMs = now.getTime() - hours * 60 * 60 * 1000;
  const buckets: RagTrendBucket[] = [];
  for (let i = 0; i < totalBuckets; i += 1) {
    const start = fromMs + i * bucketMs;
    const end = start + bucketMs;
    const windowSignals = mapEventsToSignals(events, start, end);
    const overall: RagState = windowSignals.some((s) => s.severity === "red") ? "red" : windowSignals.some((s) => s.severity === "amber") ? "amber" : "green";
    const topSignal = windowSignals
      .filter((s) => s.severity !== "green")
      .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "red" ? -1 : 1))[0]?.key;
    const totalCount = windowSignals.reduce((sum, s) => sum + s.count, 0);
    buckets.push({
      at: new Date(start).toISOString(),
      green: overall === "green" ? 1 : 0,
      amber: overall === "amber" ? 1 : 0,
      red: overall === "red" ? 1 : 0,
      score: computeScore(overall, totalCount),
      topSignalKey: topSignal ?? null,
    });
  }
  return { bucketMinutes, fromIso: new Date(fromMs).toISOString(), toIso: now.toISOString(), buckets, direction: deriveDirection(buckets) };
}

function parseActivity(row: any): SignalEvent | null {
  const type = (row?.type ?? "").toString().toLowerCase();
  let key: SignalKey | null = null;
  let surface: string | null = null;
  if (type.startsWith("monetisation.billing_portal_error") || type.startsWith("monetisation.sub_portal_open_failed")) {
    key = "portal_errors";
    surface = "portal";
  } else if (type.startsWith("monetisation.checkout_start_failed") || type.startsWith("monetisation.checkout_redirect_blocked")) {
    key = "checkout_errors";
    surface = "checkout";
  } else if (type.startsWith("monetisation.webhook_error")) {
    key = "webhook_errors";
    surface = "webhook";
  }
  if (!key) return null;
  let code: string | null = type.split(".").pop() ?? null;
  let requestId: string | null = null;
  try {
    const meta = JSON.parse(row?.body ?? "{}");
    code = (meta.code ?? meta.error_code ?? code ?? "unknown").toString();
    requestId = meta.requestId ?? meta.request_id ?? null;
  } catch {
    // swallow
  }
  const atMs = new Date(row?.occurred_at ?? row?.created_at ?? Date.now()).getTime();
  return { key, atMs, code, surface, requestId };
}

function parseWebhookFailure(item: Awaited<ReturnType<typeof listWebhookFailures>>["items"][number]): SignalEvent {
  return {
    key: "webhook_failures",
    atMs: new Date(item.at).getTime(),
    code: (item.code ?? "unknown").toString(),
    surface: "webhook",
    requestId: item.requestId ?? null,
  };
}

function parseRateLimitLog(entry: ReturnType<typeof getRateLimitLog>[number]): SignalEvent {
  return {
    key: "rate_limits",
    atMs: entry.at,
    code: (entry.route ?? "unknown").toString(),
    surface: entry.category ?? "ops",
  };
}

export async function buildRagStatus({ now = new Date(), windowMinutes = 15, trendHours = 24 }: { now?: Date; windowMinutes?: number; trendHours?: number } = {}): Promise<RagStatus> {
  const admin = createServiceRoleClient();
  const fromTrend = new Date(now.getTime() - trendHours * 60 * 60 * 1000).toISOString();

  const activitiesPromise = admin
    .from("application_activities")
    .select("id,type,body,occurred_at,created_at")
    .gte("occurred_at", fromTrend)
    .or(
      [
        "type.ilike.monetisation.billing_portal_error%",
        "type.ilike.monetisation.sub_portal_open_failed%",
        "type.ilike.monetisation.checkout_start_failed%",
        "type.ilike.monetisation.checkout_redirect_blocked%",
        "type.ilike.monetisation.webhook_error%",
      ].join(",")
    )
    .order("occurred_at", { ascending: false })
    .limit(1500);

  const [activitiesRes, webhookFailures, rateLimitLog] = await Promise.all([
    activitiesPromise,
    listWebhookFailures({ sinceHours: trendHours, limit: 300, now }),
    Promise.resolve(getRateLimitLog({ sinceMs: now.getTime() - trendHours * 60 * 60 * 1000 })),
  ]);

  const events: SignalEvent[] = [];
  (activitiesRes.data ?? []).forEach((row: any) => {
    const parsed = parseActivity(row);
    if (parsed) events.push(parsed);
  });
  (webhookFailures.items ?? []).forEach((item) => events.push(parseWebhookFailure(item)));
  (rateLimitLog ?? []).forEach((entry) => events.push(parseRateLimitLog(entry)));

  const windowFromMs = now.getTime() - windowMinutes * 60 * 1000;
  const windowToMs = now.getTime();
  const signals = mapEventsToSignals(events, windowFromMs, windowToMs);
  const status: RagState = signals.some((s) => s.severity === "red") ? "red" : signals.some((s) => s.severity === "amber") ? "amber" : "green";
  const topIssues = deriveTopIssues(signals);
  const trend = computeTrend(events, { now, bucketMinutes: 15, hours: trendHours });
  const topRepeats = buildTopRepeats(events, windowFromMs, windowToMs);

  return {
    rulesVersion: "rag_v2_15m_trend",
    window: { minutes: windowMinutes, fromIso: new Date(windowFromMs).toISOString(), toIso: now.toISOString() },
    status,
    overall: status,
    headline: buildHeadline(status, topIssues),
    signals,
    topIssues,
    trend,
    topRepeats,
    updatedAt: now.toISOString(),
  };
}
