import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { getAlertOwnershipMap } from "@/lib/ops/alerts-ownership";
import { getSnoozeMap } from "@/lib/ops/alerts-snooze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_workflow_get");
  const limiter = checkRateLimit({
    route: "ops_alerts_workflow_get",
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
      meta: { limitKey: "ops_alerts_workflow_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const windowLabel = "15m";
    const now = new Date();
    const ownership = await getAlertOwnershipMap({ windowLabel, now });
    const snoozes = await getSnoozeMap({ windowLabel, now });
    return NextResponse.json({ ok: true, requestId, ownership, snoozes, serverNow: now.toISOString(), currentUserId: user.id }, { headers });
  } catch (error) {
    return jsonError({ code: "WORKFLOW_FETCH_FAILED", message: "Unable to load workflow state", requestId, status: 500 });
  }
}
