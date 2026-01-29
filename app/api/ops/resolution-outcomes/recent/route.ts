import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { listRecentOutcomes, maskResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const budget = getRateLimitBudget("ops_resolution_outcomes_recent");
  const limiter = checkRateLimit({
    route: "ops_resolution_outcomes_recent",
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
      meta: { limitKey: "ops_resolution_outcomes_recent", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const requestIdFilter = url.searchParams.get("requestId");
  const userIdFilter = url.searchParams.get("userId");
  const limitParam = Number(url.searchParams.get("limit") ?? "4");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 12) : 4;

  const outcomes = await listRecentOutcomes({
    requestId: requestIdFilter || null,
    userId: requestIdFilter ? null : userIdFilter || null,
    limit,
  });
  const items = outcomes.map(maskResolutionOutcome);

  return NextResponse.json({ ok: true, requestId, items }, { headers });
}
