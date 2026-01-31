import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import { assignCaseWorkflow, sanitizeCaseWorkflowMeta } from "@/lib/ops/ops-case-workflow";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { insertCaseAudit } from "@/lib/ops/ops-case-audit";
import { logMonetisationEvent } from "@/lib/monetisation";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  if (!isAdminRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Admin role required", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_assign");
  const limiter = checkRateLimit({
    route: "ops_case_assign",
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
      meta: { limitKey: "ops_case_assign", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const caseRequestId = normaliseId(body?.requestId);
  const assignedToUserId = normaliseId(body?.assignedToUserId);
  if (!caseRequestId || !assignedToUserId) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId and assignedToUserId required", requestId, status: 400 });
  }

  try {
    const row = await assignCaseWorkflow({ requestId: caseRequestId, assignedToUserId });
    const admin = createServiceRoleClient();
    const meta = sanitizeCaseWorkflowMeta({ requestId: caseRequestId, assignedToUserId });
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: assignedToUserId,
      action: "ops_case_assign",
      meta,
    });
    await insertCaseAudit({
      requestId: caseRequestId,
      actorUserId: user.id,
      action: "SET_STATUS",
      meta: { assignedToUserId },
    });

    try {
      await logMonetisationEvent(admin as any, user.id, "ops_case_assign", {
        meta: { hasAssignee: Boolean(assignedToUserId) },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        workflow: {
          requestId: row.request_id,
          status: row.status,
          priority: row.priority,
          assignedToUserId: row.assigned_to_user_id ?? null,
          claimedAt: row.claimed_at ?? null,
          resolvedAt: row.resolved_at ?? null,
          closedAt: row.closed_at ?? null,
          lastTouchedAt: row.last_touched_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/assign", code: "OPS_CASE_ASSIGN_FAIL" });
    return jsonError({ code: "OPS_CASE_ASSIGN_FAIL", message: "Unable to assign case", requestId });
  }
}
