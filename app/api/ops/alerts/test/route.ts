import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createOpsAlertTestEvent } from "@/lib/ops/ops-alerts-test-event";

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

  let eventId: string | null = null;
  try {
    const created = await createOpsAlertTestEvent({ actorUserId: user.id, requestId, now });
    eventId = created.eventId ?? null;
  } catch {
    return jsonError({ code: "ALERT_TEST_FAIL", message: "Unable to save test alert", requestId, status: 500 });
  }

  testSendCache.set(cacheKey, { until: now.getTime() + TEST_DEDUPE_WINDOW_MS, eventId });

  return NextResponse.json({ ok: true, requestId, eventId }, { headers });
}
