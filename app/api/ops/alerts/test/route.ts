import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyAlertTransitions } from "@/lib/ops/ops-alerts-notify";

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
  const nowIso = now.toISOString();
  const admin = createServiceRoleClient();
  await admin.from("ops_alert_events").insert({
    key: "ops_alert_test",
    state: "firing",
    at: nowIso,
    summary_masked: "Test alert fired",
    signals_masked: { test: true },
    window: "test",
    rules_version: "ops_alerts_v1_15m",
  });

  await notifyAlertTransitions({
    transitions: [{ key: "ops_alert_test", to: "firing" }],
    alerts: [
      {
        key: "ops_alert_test" as any,
        severity: "low",
        state: "firing",
        summary: "Test alert fired",
        signals: { test: true },
        actions: [{ label: "Open alerts", href: "/app/ops/alerts", kind: "alerts" }],
      },
    ],
    previousStates: {},
    now,
  });

  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alert_test_fire",
    meta: { requestId },
  });

  return NextResponse.json({ ok: true, requestId }, { headers });
}
