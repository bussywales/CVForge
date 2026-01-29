import "server-only";

import { hashAlertPayload, updateAlertNotificationMeta, type AlertStateRow } from "@/lib/ops/ops-alerts-store";
import type { OpsAlert } from "@/lib/ops/ops-alerts";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { recordAlertDelivery } from "@/lib/ops/ops-alerts-delivery";
import { getAlertsWebhookConfig } from "@/lib/ops/alerts-webhook-config";

type Transition = { key: string; to: "ok" | "firing" };

function buildPayload(alert: OpsAlert, now: Date, eventId?: string | null, ackUrl?: string | null) {
  const windowMinutes = 15;
  const windowTo = now.toISOString();
  const windowFrom = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();
  return {
    eventId: eventId ?? null,
    key: alert.key,
    severity: alert.severity,
    state: alert.state,
    summary: alert.summary,
    window: "15m",
    windowMinutes,
    windowFrom,
    windowTo,
    at: now.toISOString(),
    actions:
      alert.actions?.map((a) => ({ label: a.label, href: a.href, kind: a.kind ?? null }))?.concat(
        eventId ? [{ label: "Mark handled (webhook)", href: `/api/ops/alerts/ack?eventId=${encodeURIComponent(eventId)}`, kind: "ack" }] : []
      ) ?? (eventId ? [{ label: "Mark handled (webhook)", href: `/api/ops/alerts/ack?eventId=${encodeURIComponent(eventId)}`, kind: "ack" }] : []),
    signals: alert.signals ?? {},
    headline: alert.summary,
    ackUrl,
  };
}

export async function notifyAlertTransitions({
  transitions,
  alerts,
  previousStates,
  now = new Date(),
  includeResolutions = true,
  eventIdsByKey = {},
  ackUrlByEventId = {},
}: {
  transitions: Transition[];
  alerts: OpsAlert[];
  previousStates: Record<string, AlertStateRow>;
  now?: Date;
  includeResolutions?: boolean;
  eventIdsByKey?: Record<string, string>;
  ackUrlByEventId?: Record<string, string>;
}) {
  const config = getAlertsWebhookConfig();
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  const secret = process.env.OPS_ALERT_WEBHOOK_SECRET;
  const results: Array<{ key: string; sent: boolean; error?: string }> = [];
  if (!config.configured || !url) {
    const error = config.mode === "enabled" ? "missing_webhook" : config.mode;
    transitions.forEach((t) => results.push({ key: t.key, sent: false, error }));
    return results;
  }
  const nowIso = now.toISOString();
  const admin = createServiceRoleClient();

  for (const transition of transitions) {
    if (transition.to === "ok" && !includeResolutions) {
      continue;
    }
    const alert = alerts.find((a) => a.key === transition.key);
    if (!alert) continue;
    const prev = previousStates[transition.key];
    const payloadHash = hashAlertPayload(alert);
    const lastNotifiedAt = prev?.last_notified_at ? new Date(prev.last_notified_at).getTime() : null;
    const withinCooldown = typeof lastNotifiedAt === "number" ? now.getTime() - lastNotifiedAt < 30 * 60 * 1000 : false;
    if (transition.to === "firing" && withinCooldown && payloadHash === (prev?.last_payload_hash ?? null)) {
      results.push({ key: transition.key, sent: false, error: "cooldown" });
      continue;
    }
    try {
      await admin.from("ops_audit_log").insert({
        actor_user_id: null,
        target_user_id: null,
        action: "ops_alert_notify_attempt",
        meta: { key: transition.key, requestId: null },
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const eventId = eventIdsByKey[alert.key] ?? null;
      const ackUrl = eventId && ackUrlByEventId[eventId] ? ackUrlByEventId[eventId] : null;
      const payload = buildPayload(alert, now, eventId, ackUrl);
      await recordAlertDelivery({ eventId: eventId ?? transition.key, status: "sent", channel: "webhook", at: now, windowLabel: "15m" });
      let delivered = false;
      let maskedReason: string | null = null;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (secret) headers["x-ops-alert-secret"] = secret;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        delivered = res.ok;
        if (!res.ok) maskedReason = `status_${res.status}`;
      } catch (err) {
        maskedReason = (err as Error)?.message?.slice(0, 120) ?? "fetch_failed";
      }
      clearTimeout(timer);
      await updateAlertNotificationMeta(transition.key, { lastNotifiedAt: nowIso, payloadHash });
      await admin.from("ops_audit_log").insert({
        actor_user_id: null,
        target_user_id: null,
        action: delivered ? "ops_alert_notify_success" : "ops_alert_notify_fail",
        meta: { key: transition.key, eventId, reason: maskedReason ?? null },
      });
      await recordAlertDelivery({
        eventId: eventId ?? transition.key,
        status: delivered ? "delivered" : "failed",
        channel: "webhook",
        at: now,
        maskedReason,
        windowLabel: "15m",
      });
      await admin.from("ops_audit_log").insert({
        actor_user_id: null,
        target_user_id: null,
        action: delivered ? "ops_alerts_notify_delivered" : "ops_alerts_notify_failed",
        meta: { key: transition.key, eventId, severity: alert.severity, windowMinutes: 15, reason: maskedReason ?? null },
      });
      results.push({ key: transition.key, sent: delivered });
    } catch (error) {
      await admin.from("ops_audit_log").insert({
        actor_user_id: null,
        target_user_id: null,
        action: "ops_alert_notify_fail",
        meta: { key: transition.key, error: (error as Error)?.message?.slice(0, 120) ?? "notify_fail" },
      });
      const eventId = eventIdsByKey[alert.key] ?? transition.key;
      await recordAlertDelivery({
        eventId,
        status: "failed",
        channel: "webhook",
        at: now,
        maskedReason: (error as Error)?.message?.slice(0, 120) ?? "notify_fail",
        windowLabel: "15m",
      });
      results.push({ key: transition.key, sent: false, error: (error as Error)?.message ?? "notify_fail" });
    }
  }

  return results;
}
