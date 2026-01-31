import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { logMonetisationEvent } from "@/lib/monetisation";
import { captureServerError } from "@/lib/observability/sentry";
import { upsertCaseQueueSource } from "@/lib/ops/ops-case-queue-store";
import { insertCaseAudit } from "@/lib/ops/ops-case-audit";
import {
  insertCaseEvidence,
  normaliseEvidenceType,
  sanitizeEvidenceBody,
  sanitizeEvidenceMeta,
} from "@/lib/ops/ops-case-evidence";
import { getOrCreateCaseWorkflow, touchCaseWorkflow } from "@/lib/ops/ops-case-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_evidence");
  const limiter = checkRateLimit({
    route: "ops_case_evidence",
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
      meta: { limitKey: "ops_case_evidence", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
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
  const type = normaliseEvidenceType(body?.type);
  const cleanedBody = sanitizeEvidenceBody(typeof body?.body === "string" ? body.body : "");
  if (!caseRequestId || !type || !cleanedBody) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId, type, and body required", requestId, status: 400 });
  }

  try {
    await getOrCreateCaseWorkflow({ requestId: caseRequestId });
    const row = await insertCaseEvidence({
      requestId: caseRequestId,
      type,
      body: cleanedBody,
      meta: sanitizeEvidenceMeta(body?.meta ?? undefined),
      actorUserId: user.id,
    });
    await touchCaseWorkflow({ requestId: caseRequestId });

    try {
      await upsertCaseQueueSource({
        requestId: caseRequestId,
        code: "MANUAL",
        primarySource: "ops_case_evidence",
        detail: `Evidence added: ${type}`,
      });
    } catch {
      // best-effort only
    }

    const admin = createServiceRoleClient();
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: null,
      action: "ops_case_evidence_add",
      meta: sanitizeEvidenceMeta({ requestId: caseRequestId, type }),
    });
    await insertCaseAudit({
      requestId: caseRequestId,
      actorUserId: user.id,
      action: "ADD_EVIDENCE",
      meta: { type },
    });

    try {
      await logMonetisationEvent(admin as any, user.id, "ops_case_evidence_add", {
        meta: { type },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        evidence: {
          id: row.id,
          requestId: row.request_id,
          type: row.type,
          body: row.body,
          meta: row.meta ?? null,
          createdByUserId: row.created_by_user_id,
          createdAt: row.created_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/evidence", code: "OPS_CASE_EVIDENCE_FAIL" });
    return jsonError({ code: "OPS_CASE_EVIDENCE_FAIL", message: "Unable to add evidence", requestId });
  }
}
