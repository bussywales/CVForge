import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyAlertTransitions } from "@/lib/ops/ops-alerts-notify";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_DEDUPE_WINDOW_MS = 10_000;
const testSendCache = new Map<string, { until: number; eventId: string | null }>();

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
  const budget = getRateLimitBudget("ops_alerts_test");
  const limiter = checkRateLimit({ route: "ops_alerts_test", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_test", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const now = new Date();
  const cacheKey = `${user.id}:15m`;
  const cached = testSendCache.get(cacheKey);
  if (cached && cached.until > now.getTime()) {
    return NextResponse.json({ ok: true, requestId, eventId: cached.eventId, deduped: true }, { headers });
  }

  const nowIso = now.toISOString();
  const admin = createServiceRoleClient();
  const signals = { is_test: true, severity: "low" };
  const { data: inserted, error: insertError } = await admin
    .from("ops_alert_events")
    .insert({
      key: "ops_alert_test",
      state: "firing",
      at: nowIso,
      summary_masked: "Test alert fired",
      signals_masked: sanitizeMonetisationMeta(signals),
      window_label: "test",
      rules_version: "ops_alerts_v1_15m",
    })
    .select("id")
    .single();
  const eventId = inserted?.id ?? null;
  if (insertError) {
    return jsonError({ code: "ALERT_TEST_FAIL", message: "Unable to save test alert", requestId, status: 500 });
  }

  await notifyAlertTransitions({
    transitions: [{ key: "ops_alert_test", to: "firing" }],
    alerts: [
      {
        key: "ops_alert_test" as any,
        severity: "low",
        state: "firing",
        summary: "Test alert fired",
        signals,
        actions: [{ label: "Open alerts", href: "/app/ops/alerts", kind: "alerts" }],
      },
    ],
    previousStates: {},
    now,
    eventIdsByKey: { ops_alert_test: eventId ?? undefined } as any,
  });

  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alert_test_fire",
    meta: { requestId },
  });

  testSendCache.set(cacheKey, { until: now.getTime() + TEST_DEDUPE_WINDOW_MS, eventId });

  return NextResponse.json({ ok: true, requestId, eventId }, { headers });
}
