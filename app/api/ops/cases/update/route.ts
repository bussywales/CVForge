import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  assignCaseWorkflow,
  getCaseWorkflow,
  getOrCreateCaseWorkflow,
  normaliseCasePriority,
  normaliseCaseStatus,
  sanitizeCaseWorkflowMeta,
  updateCasePriority,
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

  const budget = getRateLimitBudget("ops_cases_update");
  const limiter = checkRateLimit({
    route: "ops_cases_update",
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
      meta: { limitKey: "ops_cases_update", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
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
  const status = body?.status ? normaliseCaseStatus(body.status) : null;
  const priority = body?.priority ? normaliseCasePriority(body.priority) : null;
  const assignedUserId = body?.assignedUserId === null ? null : normaliseId(body?.assignedUserId);

  if (!caseRequestId) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId required", requestId, status: 400 });
  }
  if (body?.status && !status) {
    return jsonError({ code: "BAD_REQUEST", message: "Invalid status", requestId, status: 400 });
  }
  if (body?.priority && !priority) {
    return jsonError({ code: "BAD_REQUEST", message: "Invalid priority", requestId, status: 400 });
  }
  if (body?.assignedUserId !== undefined && body?.assignedUserId !== null && !assignedUserId) {
    return jsonError({ code: "BAD_REQUEST", message: "Invalid assignedUserId", requestId, status: 400 });
  }
  if (body?.assignedUserId !== undefined && !isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Admin role required to assign", requestId, status: 403 });
  }
  if (status === "closed" && !isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Admin role required to close case", requestId, status: 403 });
  }
  if (!status && !priority && body?.assignedUserId === undefined) {
    return jsonError({ code: "BAD_REQUEST", message: "No changes requested", requestId, status: 400 });
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

    let workflow = existing ?? (await getOrCreateCaseWorkflow({ requestId: caseRequestId }));
    if (body?.assignedUserId !== undefined) {
      workflow = await assignCaseWorkflow({ requestId: caseRequestId, assignedToUserId: assignedUserId });
    }
    if (status) {
      workflow = await updateCaseStatus({ requestId: caseRequestId, status, priority: priority ?? workflow.priority });
    } else if (priority) {
      workflow = await updateCasePriority({ requestId: caseRequestId, priority });
    }

    const admin = createServiceRoleClient();
    const meta = sanitizeCaseWorkflowMeta({ requestId: caseRequestId, status: workflow.status, priority: workflow.priority });
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: workflow.assigned_to_user_id ?? null,
      action: "ops_case_status_change",
      meta,
    });

    try {
      if (status) {
        await logMonetisationEvent(admin as any, user.id, "ops_cases_status_change", { meta: { status } });
      }
      if (priority) {
        await logMonetisationEvent(admin as any, user.id, "ops_cases_priority_change", { meta: { priority } });
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        workflow: {
          requestId: workflow.request_id,
          status: workflow.status,
          priority: workflow.priority,
          assignedToUserId: workflow.assigned_to_user_id ?? null,
          claimedAt: workflow.claimed_at ?? null,
          resolvedAt: workflow.resolved_at ?? null,
          closedAt: workflow.closed_at ?? null,
          lastTouchedAt: workflow.last_touched_at,
          createdAt: workflow.created_at,
          updatedAt: workflow.updated_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/update", code: "OPS_CASES_UPDATE_FAIL" });
    return jsonError({ code: "OPS_CASES_UPDATE_FAIL", message: "Unable to update case", requestId });
  }
}
