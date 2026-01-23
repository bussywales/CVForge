import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { computeFunnelSummary } from "@/lib/ops/funnel";
import { logMonetisationEvent } from "@/lib/monetisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user, supabase } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("ops_funnel_get");
  const limiter = checkRateLimit({ route: "ops_funnel_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_funnel_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const url = new URL(request.url);
    const groupBySource = url.searchParams.get("groupBy") === "source";
    const windowParam = url.searchParams.get("window");
    const source = url.searchParams.get("source");
    const includeUnknown = url.searchParams.get("includeUnknown") !== "0";
    const window = windowParam === "24h" || windowParam === "7d" ? windowParam : undefined;
    const summary = await computeFunnelSummary({ supabase, groupBySource, source: source ?? undefined, window, includeUnknown });
    try {
      await logMonetisationEvent(supabase as any, user.id, groupBySource ? "ops_funnel_groupby_source_view" : "ops_funnel_view", {
        meta: { groupBySource, source: source ?? "all", window: window ?? "all", includeUnknown },
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true, requestId, summary }, { headers });
  } catch {
    return jsonError({ code: "OPS_FUNNEL_FAILED", message: "Unable to load funnel", requestId, status: 500 });
  }
}
