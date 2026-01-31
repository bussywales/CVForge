import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import { listCaseAudit } from "@/lib/ops/ops-case-audit";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_audit_get");
  const limiter = checkRateLimit({
    route: "ops_case_audit_get",
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
      meta: { limitKey: "ops_case_audit_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const url = new URL(request.url);
    const caseRequestId = normaliseId(url.searchParams.get("requestId"));
    if (!caseRequestId) {
      return jsonError({ code: "BAD_REQUEST", message: "requestId required", requestId, status: 400 });
    }
    let limit = Number(url.searchParams.get("limit") ?? 50);
    if (Number.isNaN(limit) || limit <= 0) {
      return jsonError({ code: "BAD_REQUEST", message: "Invalid limit", requestId, status: 400 });
    }
    limit = Math.min(limit, 200);
    const rows = await listCaseAudit({ requestId: caseRequestId, limit });
    return NextResponse.json(
      {
        ok: true,
        requestId,
        items: rows.map((row) => ({
          id: row.id,
          requestId: row.request_id,
          action: row.action,
          actorUserId: row.actor_user_id ?? null,
          createdAt: row.created_at,
          meta: row.meta ?? null,
        })),
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/audit", code: "OPS_CASE_AUDIT_FAIL" });
    return jsonError({ code: "OPS_CASE_AUDIT_FAIL", message: "Unable to load case audit", requestId });
  }
}
