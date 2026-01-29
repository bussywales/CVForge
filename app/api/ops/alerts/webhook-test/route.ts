import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyAlertTransitions } from "@/lib/ops/ops-alerts-notify";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { getAlertsWebhookConfig } from "@/lib/ops/alerts-webhook-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }
  const budget = getRateLimitBudget("ops_alerts_webhook_test");
  const limiter = checkRateLimit({ route: "ops_alerts_webhook_test", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_webhook_test", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const config = getAlertsWebhookConfig();
  if (!config.configured) {
    return jsonError({ code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook not configured", requestId, status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const admin = createServiceRoleClient();
  const signals = { is_test: true, severity: "low", webhook_test: true };
  const { data: inserted, error: insertError } = await admin
    .from("ops_alert_events")
    .insert({
      key: "ops_alert_webhook_test",
      state: "firing",
      at: nowIso,
      summary_masked: "Webhook test notification",
      signals_masked: sanitizeMonetisationMeta(signals),
      window_label: "test",
      rules_version: "ops_alerts_v1_15m",
    })
    .select("id")
    .single();
  const eventId = inserted?.id ?? null;
  if (insertError || !eventId) {
    return jsonError({ code: "WEBHOOK_TEST_FAILED", message: "Unable to queue webhook test", requestId, status: 500 });
  }

  await notifyAlertTransitions({
    transitions: [{ key: "ops_alert_webhook_test", to: "firing" }],
    alerts: [
      {
        key: "ops_alert_webhook_test" as any,
        severity: "low",
        state: "firing",
        summary: "Webhook test notification",
        signals,
        actions: [{ label: "Open alerts", href: "/app/ops/alerts", kind: "alerts" }],
      },
    ],
    previousStates: {},
    now,
    eventIdsByKey: { ops_alert_webhook_test: eventId } as any,
  });

  return NextResponse.json({ ok: true, requestId, eventId }, { headers });
}
