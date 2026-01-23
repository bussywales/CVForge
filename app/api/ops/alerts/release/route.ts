import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { releaseAlert } from "@/lib/ops/alerts-ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_release");
  const limiter = checkRateLimit({
    route: "ops_alerts_release",
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
      meta: { limitKey: "ops_alerts_release", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const alertKey = typeof body?.alertKey === "string" ? body.alertKey : null;
  const windowLabel = typeof body?.windowLabel === "string" ? body.windowLabel : "15m";
  if (!alertKey) return jsonError({ code: "INVALID_ALERT", message: "alertKey required", requestId, status: 400 });

  try {
    await releaseAlert({ alertKey, windowLabel, actorId: user.id });
    return NextResponse.json({ ok: true, requestId }, { headers });
  } catch (error) {
    return jsonError({ code: "RELEASE_FAILED", message: "Unable to release alert", requestId, status: 500 });
  }
}
