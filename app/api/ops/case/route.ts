import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { normaliseId } from "@/lib/ops/normalise-id";
import { resolveCaseWindow } from "@/lib/ops/ops-case-model";
import { getOrCreateCaseWorkflow } from "@/lib/ops/ops-case-workflow";
import { listCaseEvidence } from "@/lib/ops/ops-case-evidence";
import { resolveRequestContext } from "@/lib/ops/ops-request-context";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_get");
  const limiter = checkRateLimit({
    route: "ops_case_get",
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
      meta: { limitKey: "ops_case_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const requestIdParam = normaliseId(url.searchParams.get("requestId"));
  const window = resolveCaseWindow(url.searchParams.get("window"));
  if (!requestIdParam) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId required", requestId, status: 400 });
  }

  try {
    const [workflow, evidence, context] = await Promise.all([
      getOrCreateCaseWorkflow({ requestId: requestIdParam }),
      listCaseEvidence({ requestId: requestIdParam, limit: 20 }),
      resolveRequestContext({ requestId: requestIdParam, window, actorUserId: user.id }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        requestId,
        window,
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
        evidence: evidence.map((item) => ({
          id: item.id,
          requestId: item.request_id,
          type: item.type,
          body: item.body,
          meta: item.meta ?? null,
          createdByUserId: item.created_by_user_id,
          createdAt: item.created_at,
        })),
        context: context
          ? {
              requestId: context.request_id,
              userId: context.user_id,
              emailMasked: context.email_masked,
              source: context.source,
              confidence: context.confidence,
              evidenceAt: context.updated_at ?? context.last_seen_at ?? null,
              sources: context.sources,
              firstSeenAt: context.first_seen_at,
              lastSeenAt: context.last_seen_at,
              lastSeenPath: context.last_seen_path,
            }
          : null,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case", code: "OPS_CASE_LOAD_FAIL" });
    return jsonError({ code: "OPS_CASE_LOAD_FAIL", message: "Unable to load case", requestId });
  }
}
