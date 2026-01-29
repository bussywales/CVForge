import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit, getRateLimitLog } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { buildRagStatus } from "@/lib/ops/rag-status";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import { buildOpsAlerts } from "@/lib/ops/ops-alerts";
import { loadAlertStates, saveAlertStatesAndEvents, listRecentAlertEvents, listHandledAlertEvents } from "@/lib/ops/ops-alerts-store";
import { notifyAlertTransitions } from "@/lib/ops/ops-alerts-notify";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAlertsWebhookConfig } from "@/lib/ops/alerts-webhook-config";
import { signAckToken } from "@/lib/ops/alerts-ack-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function aggregateRateLimits(entries: ReturnType<typeof getRateLimitLog>) {
  const hits = entries.length;
  const map = new Map<string, number>();
  entries.forEach((entry) => {
    map.set(entry.route, (map.get(entry.route) ?? 0) + 1);
  });
  const topRoutes = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([route, count]) => ({ route, count }));
  return { hits, topRoutes };
}

async function listHandledAlerts({ sinceHours = 24, now = new Date() }: { sinceHours?: number; now?: Date }) {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("application_activities")
    .select("id,body,occurred_at,created_at")
    .eq("type", "monetisation.ops_resolution_outcome_set")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(100);
  const handled: Record<string, { at: string }> = {};
  (data ?? []).forEach((row: any) => {
    try {
      const meta = JSON.parse(row.body ?? "{}");
      if (meta?.code === "alert_handled" && meta?.alertKey) {
        const at = row.occurred_at ?? row.created_at ?? now.toISOString();
        if (!handled[meta.alertKey]) handled[meta.alertKey] = { at };
      }
    } catch {
      /* ignore */
    }
  });
  return handled;
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }
  const budget = getRateLimitBudget("ops_alerts_get");
  const limiter = checkRateLimit({ route: "ops_alerts_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const now = new Date();
  try {
    const previousStates = await loadAlertStates();
    const rag = await buildRagStatus({ now, windowMinutes: 15, trendHours: 24 });
    const webhookFailures = await listWebhookFailures({ sinceHours: 0.25, limit: 200, now });
    const portalErrors = rag?.signals?.find((s) => s.key === "portal_errors")?.count ?? 0;
    const rateLimitLog = getRateLimitLog({ sinceMs: now.getTime() - 15 * 60 * 1000 });
    const alertsModel = buildOpsAlerts({
      now,
      rag15m: rag,
      webhookFailures: {
        count: webhookFailures.items.length,
        repeats: (webhookFailures.items ?? []).filter((item) => (item.repeatCount ?? 1) >= 2).length,
      },
      portalErrors15m: portalErrors,
      rateLimit15m: aggregateRateLimits(rateLimitLog),
      lastState: previousStates,
    });

    const { transitions, eventIdsByKey } = await saveAlertStatesAndEvents({
      computedAlerts: alertsModel.alerts,
      previousStates,
      now,
      rulesVersion: alertsModel.rulesVersion,
    });

    if (transitions.length) {
      const admin = createServiceRoleClient();
      await admin.from("ops_audit_log").insert(
        transitions.map((t) => ({
          actor_user_id: user.id,
          target_user_id: null,
          action: "ops_alert_transition",
          meta: { key: t.key, to: t.to, severity: t.severity, requestId },
        }))
      );
      await notifyAlertTransitions({
        transitions: transitions.map((t) => ({ key: t.key, to: t.to } as any)),
        alerts: alertsModel.alerts,
        previousStates,
        now,
        eventIdsByKey,
        ackUrlByEventId: Object.values(eventIdsByKey ?? {}).reduce<Record<string, string>>((acc, eventId) => {
          try {
            const token = signAckToken({ eventId, exp: Math.floor(Date.now() / 1000) + 15 * 60, window_label: "15m" });
            const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
            acc[eventId] = `${base}/api/alerts/ack?token=${encodeURIComponent(token)}`;
          } catch {
            // ignore token failures
          }
          return acc;
        }, {}),
      });
    }

    const recentEvents = await listRecentAlertEvents({ sinceHours: 24, now });
    const handledEvents = await listHandledAlertEvents({ sinceHours: 24, now });
    const webhookConfig = getAlertsWebhookConfig();
    const handled = await listHandledAlerts({ sinceHours: 24, now });
    const recentEventsWithHandled = recentEvents.map((ev) => {
      const eventHandled = handledEvents[ev.id];
      const keyHandled = handled[ev.key];
      const handledMeta = eventHandled ? eventHandled : keyHandled ? { ...keyHandled, source: "ui" } : null;
      return { ...ev, handled: handledMeta };
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        window: alertsModel.window,
        rulesVersion: alertsModel.rulesVersion,
        headline: alertsModel.headline,
        firingCount: alertsModel.firingCount,
        alerts: alertsModel.alerts,
        recentEvents: recentEventsWithHandled,
        webhookConfigured: webhookConfig.configured,
        webhookConfig,
        handled,
        currentUserId: user.id,
      },
      { headers }
    );
  } catch (error) {
    const res = jsonError({ code: "ALERTS_FETCH_FAILED", message: "Unable to load alerts", requestId, status: 500 });
    return applyRequestIdHeaders(res, requestId, { noStore: true });
  }
}
