import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["open", "investigating", "monitoring", "waiting_on_user", "waiting_on_provider"] as const;

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_cases_summary");
  const limiter = checkRateLimit({
    route: "ops_cases_summary",
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
      meta: { limitKey: "ops_cases_summary", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const admin = createServiceRoleClient();

    const [{ count: myAssignedCount }, { count: unassignedCount }] = await Promise.all([
      admin
        .from("ops_case_workflow")
        .select("request_id", { count: "exact", head: true })
        .eq("assigned_to_user_id", user.id)
        .in("status", ACTIVE_STATUSES),
      admin
        .from("ops_case_workflow")
        .select("request_id", { count: "exact", head: true })
        .is("assigned_to_user_id", null)
        .in("status", ACTIVE_STATUSES),
    ]);

    const { data: ageingRows, error: ageingError } = await admin
      .from("ops_case_workflow")
      .select("last_touched_at")
      .eq("assigned_to_user_id", user.id)
      .in("status", ACTIVE_STATUSES)
      .limit(500);
    if (ageingError) throw ageingError;

    const nowMs = Date.now();
    const buckets = { over1h: 0, over6h: 0, over24h: 0 };
    (ageingRows ?? []).forEach((row) => {
      const lastTouched = row.last_touched_at ? new Date(row.last_touched_at).getTime() : null;
      if (!lastTouched || Number.isNaN(lastTouched)) return;
      const ageMs = nowMs - lastTouched;
      if (ageMs >= 60 * 60 * 1000) buckets.over1h += 1;
      if (ageMs >= 6 * 60 * 60 * 1000) buckets.over6h += 1;
      if (ageMs >= 24 * 60 * 60 * 1000) buckets.over24h += 1;
    });

    const statusCounts: Record<string, number> = {};
    for (const status of [...ACTIVE_STATUSES, "resolved", "closed"]) {
      const { count } = await admin
        .from("ops_case_workflow")
        .select("request_id", { count: "exact", head: true })
        .eq("status", status);
      statusCounts[status] = count ?? 0;
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        summary: {
          myAssignedCount: myAssignedCount ?? 0,
          unassignedCount: unassignedCount ?? 0,
          ageingBuckets: buckets,
          statusCounts,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/summary", code: "OPS_CASES_SUMMARY_FAIL" });
    return jsonError({ code: "OPS_CASES_SUMMARY_FAIL", message: "Unable to load case summary", requestId });
  }
}
