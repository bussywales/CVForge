import "server-only";

import { buildOpsIncidentsLink, buildOpsWebhooksLink } from "@/lib/ops/ops-links";
import type { RagStatus } from "@/lib/ops/rag-status";

export type AlertState = "ok" | "firing";
export type AlertSeverity = "low" | "medium" | "high";

export type StoredAlertState = {
  state: AlertState;
  started_at?: string | null;
  last_seen_at?: string | null;
  last_notified_at?: string | null;
  last_payload_hash?: string | null;
};

export type OpsAlert = {
  key: AlertKey;
  severity: AlertSeverity;
  state: AlertState;
  startedAt?: string | null;
  lastSeenAt?: string | null;
  summary: string;
  signals: Record<string, any>;
  actions: Array<{ label: string; href: string; kind?: string }>;
};

export type OpsAlertsModel = {
  rulesVersion: "ops_alerts_v1_15m";
  window: { minutes: number; fromIso: string; toIso: string };
  headline: string;
  firingCount: number;
  alerts: OpsAlert[];
};

export type AlertKey = "ops_alert_rag_red" | "ops_alert_webhook_failures_spike" | "ops_alert_portal_errors_spike" | "ops_alert_rate_limit_pressure" | "ops_alert_test";

type BuildInput = {
  now?: Date;
  rag15m: RagStatus | null;
  webhookFailures: { count: number; repeats: number };
  portalErrors15m: number;
  rateLimit15m: { hits: number; topRoutes: Array<{ route: string; count: number }> };
  lastState?: Record<string, StoredAlertState>;
};

function resolveTimes(key: AlertKey, state: AlertState, nowIso: string, lastState?: Record<string, StoredAlertState>) {
  const prev = lastState?.[key];
  const startedAt = state === "firing" ? prev?.started_at ?? nowIso : null;
  const lastSeenAt = state === "firing" ? nowIso : prev?.last_seen_at ?? null;
  return { startedAt, lastSeenAt };
}

function buildHeadline(alerts: OpsAlert[]) {
  const firing = alerts.filter((a) => a.state === "firing");
  if (!firing.length) return "No alerts firing (last 15m)";
  const top = firing[0];
  return `${firing.length} alert${firing.length > 1 ? "s" : ""} firing · ${top.summary}`;
}

export function buildOpsAlerts({ now = new Date(), rag15m, webhookFailures, portalErrors15m, rateLimit15m, lastState }: BuildInput): OpsAlertsModel {
  const nowIso = now.toISOString();
  const alerts: OpsAlert[] = [];

  // RAG red
  if (rag15m) {
    const key: AlertKey = "ops_alert_rag_red";
    const state: AlertState = rag15m.status === "red" ? "firing" : "ok";
    const { startedAt, lastSeenAt } = resolveTimes(key, state, nowIso, lastState);
    alerts.push({
      key,
      severity: "high",
      state,
      startedAt,
      lastSeenAt,
      summary: rag15m.status === "red" ? rag15m.headline ?? "RAG is red" : "RAG not red",
      signals: { status: rag15m.status, headline: rag15m.headline, topIssue: rag15m.topIssues?.[0]?.key ?? null },
      actions: [
        { label: "Open System Status", href: "/app/ops/status#rag", kind: "status" },
        ...(rag15m.topIssues?.[0]
          ? [
              {
                label: "Top issue",
                href:
                  rag15m.topIssues[0].key === "webhook_failures"
                    ? buildOpsWebhooksLink({ window: "15m", signal: "webhook_failures" })
                    : buildOpsIncidentsLink({ window: "15m", signal: rag15m.topIssues[0].key as any, surface: rag15m.topIssues[0].key }),
              },
            ]
          : []),
      ],
    });
  }

  // Webhook failures spike
  {
    const key: AlertKey = "ops_alert_webhook_failures_spike";
    const firing = webhookFailures.count >= 3 || webhookFailures.repeats >= 2;
    const state: AlertState = firing ? "firing" : "ok";
    const { startedAt, lastSeenAt } = resolveTimes(key, state, nowIso, lastState);
    alerts.push({
      key,
      severity: firing && webhookFailures.count >= 5 ? "high" : "medium",
      state,
      startedAt,
      lastSeenAt,
      summary: firing
        ? `Webhook failures spike (${webhookFailures.count} failures, ${webhookFailures.repeats} repeats)`
        : "Webhook failures normal",
      signals: { failures: webhookFailures.count, repeats: webhookFailures.repeats },
      actions: [
        { label: "Webhook failures", href: buildOpsWebhooksLink({ window: "15m", signal: "webhook_failures" }), kind: "webhooks" },
        { label: "Incidents", href: buildOpsIncidentsLink({ window: "15m", surface: "webhook", signal: "webhook_failures" }), kind: "incidents" },
      ],
    });
  }

  // Portal errors spike
  {
    const key: AlertKey = "ops_alert_portal_errors_spike";
    const firing = portalErrors15m >= 5;
    const state: AlertState = firing ? "firing" : "ok";
    const { startedAt, lastSeenAt } = resolveTimes(key, state, nowIso, lastState);
    alerts.push({
      key,
      severity: firing && portalErrors15m >= 10 ? "high" : "medium",
      state,
      startedAt,
      lastSeenAt,
      summary: firing ? `Portal errors spike (${portalErrors15m} in 15m)` : "Portal errors normal",
      signals: { portalErrors: portalErrors15m },
      actions: [{ label: "Open portal incidents", href: buildOpsIncidentsLink({ window: "15m", surface: "portal", signal: "portal_errors" }), kind: "incidents" }],
    });
  }

  // Rate limit pressure
  {
    const key: AlertKey = "ops_alert_rate_limit_pressure";
    const criticalRoutes = ["/api/billing/recheck", "/api/monetisation/log", "/api/ops/system-status", "/api/ops/webhooks"];
    const criticalHit = rateLimit15m.topRoutes.some((r) => criticalRoutes.includes(r.route));
    const firing = rateLimit15m.hits >= 20 || criticalHit;
    const state: AlertState = firing ? "firing" : "ok";
    const { startedAt, lastSeenAt } = resolveTimes(key, state, nowIso, lastState);
    alerts.push({
      key,
      severity: firing ? "medium" : "low",
      state,
      startedAt,
      lastSeenAt,
      summary: firing
        ? `Rate limit pressure (${rateLimit15m.hits} hits${criticalHit ? " on critical routes" : ""})`
        : "Rate limits normal",
      signals: { hits: rateLimit15m.hits, topRoutes: rateLimit15m.topRoutes.slice(0, 5) },
      actions: [
        { label: "Open limits", href: "/app/ops/status#limits", kind: "status" },
        { label: "Rate limit incidents", href: buildOpsIncidentsLink({ window: "15m", surface: "billing", code: "RATE_LIMIT", signal: "rate_limits" }), kind: "incidents" },
      ],
    });
  }

  const firingCount = alerts.filter((a) => a.state === "firing").length;

  return {
    rulesVersion: "ops_alerts_v1_15m",
    window: { minutes: 15, fromIso: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), toIso: nowIso },
    headline: buildHeadline(alerts),
    firingCount,
    alerts,
  };
}
