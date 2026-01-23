import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { unsnoozeAlert } from "@/lib/ops/alerts-snooze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_unsnooze");
  const limiter = checkRateLimit({
    route: "ops_alerts_unsnooze",
    identifier: user.id,
    limit: budget.limit,
    windowMs: budget.windowMs,
    category: "ops_action",
  });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_unsnooze", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const alertKey = typeof body?.alertKey === "string" ? body.alertKey : null;
  const windowLabel = typeof body?.windowLabel === "string" ? body.windowLabel : "15m";
  if (!alertKey) return jsonError({ code: "INVALID_ALERT", message: "alertKey required", requestId, status: 400 });

  try {
    await unsnoozeAlert({ alertKey, windowLabel });
    return NextResponse.json({ ok: true, requestId }, { headers });
  } catch (error) {
    return jsonError({ code: "UNSNOOZE_FAILED", message: "Unable to unsnooze alert", requestId, status: 500 });
  }
}
