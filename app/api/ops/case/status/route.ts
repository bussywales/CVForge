import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  getCaseWorkflow,
  normaliseCasePriority,
  normaliseCaseStatus,
  sanitizeCaseWorkflowMeta,
  updateCaseStatus,
} from "@/lib/ops/ops-case-workflow";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
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

  const budget = getRateLimitBudget("ops_case_status");
  const limiter = checkRateLimit({
    route: "ops_case_status",
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
      meta: { limitKey: "ops_case_status", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
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
  const status = normaliseCaseStatus(body?.status);
  const priority = normaliseCasePriority(body?.priority);
  if (!caseRequestId || !status) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId and status required", requestId, status: 400 });
  }
  if (status === "closed" && !isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Admin role required to close case", requestId, status: 403 });
  }

  try {
    const existing = await getCaseWorkflow(caseRequestId);
    if (existing?.assigned_to_user_id && existing.assigned_to_user_id !== user.id && !isAdminRole(roleInfo.role)) {
      return jsonError({
        code: "CASE_CONFLICT",
        message: "Case is assigned to another owner",
        requestId,
        status: 409,
        meta: { assignedToUserId: existing.assigned_to_user_id, claimedAt: existing.claimed_at ?? null },
      });
    }

    const finalRow = await updateCaseStatus({ requestId: caseRequestId, status, priority });

    const admin = createServiceRoleClient();
    const meta = sanitizeCaseWorkflowMeta({ requestId: caseRequestId, status: finalRow.status, priority: finalRow.priority });
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: finalRow.assigned_to_user_id ?? null,
      action: "ops_case_status_change",
      meta,
    });

    try {
      await logMonetisationEvent(admin as any, user.id, "ops_case_status_change", {
        meta: { status: finalRow.status },
      });
      if (priority) {
        await logMonetisationEvent(admin as any, user.id, "ops_case_priority_change", {
          meta: { priority },
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        workflow: {
          requestId: finalRow.request_id,
          status: finalRow.status,
          priority: finalRow.priority,
          assignedToUserId: finalRow.assigned_to_user_id ?? null,
          claimedAt: finalRow.claimed_at ?? null,
          resolvedAt: finalRow.resolved_at ?? null,
          closedAt: finalRow.closed_at ?? null,
          lastTouchedAt: finalRow.last_touched_at,
          createdAt: finalRow.created_at,
          updatedAt: finalRow.updated_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/status", code: "OPS_CASE_STATUS_FAIL" });
    return jsonError({ code: "OPS_CASE_STATUS_FAIL", message: "Unable to update status", requestId });
  }
}
