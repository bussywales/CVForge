import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { resolveRequestContext } from "@/lib/ops/ops-request-context";
import { resolveCaseWindow } from "@/lib/ops/ops-case-model";
import { captureServerError } from "@/lib/observability/sentry";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logMonetisationEvent } from "@/lib/monetisation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_context_get");
  const limiter = checkRateLimit({
    route: "ops_case_context_get",
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
      meta: { limitKey: "ops_case_context_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const requestIdParam = url.searchParams.get("requestId")?.trim() ?? "";
  const windowParam = resolveCaseWindow(url.searchParams.get("window"));
  if (!requestIdParam) {
    return jsonError({ code: "BAD_REQUEST", message: "requestId required", requestId, status: 400 });
  }

  try {
    const context = await resolveRequestContext({ requestId: requestIdParam, window: windowParam, actorUserId: user.id });
    let userRole: string | null = null;
    if (context?.user_id) {
      const admin = createServiceRoleClient();
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", context.user_id).maybeSingle();
      userRole = roleRow?.role ?? null;
    }
    const response = {
      ok: true,
      requestId,
      requestIdHeader: requestId,
      userId: context?.user_id ?? null,
      source: context?.source ?? null,
      confidence: context?.confidence ?? null,
      sources: context?.sources ?? [],
      context: context
        ? {
            requestId: context.request_id,
            userId: context.user_id ?? null,
            emailMasked: context.email_masked ?? null,
            userRole,
            source: context.source ?? null,
            confidence: context.confidence ?? null,
            evidenceAt: context.updated_at ?? context.last_seen_at,
            sources: context.sources ?? [],
            firstSeenAt: context.first_seen_at,
            lastSeenAt: context.last_seen_at,
            lastSeenPath: context.last_seen_path ?? null,
          }
        : null,
    };
    try {
      const admin = createServiceRoleClient();
      await logMonetisationEvent(admin as any, user.id, "ops_case_context_resolve", {
        meta: {
          hasContext: Boolean(context),
          hasUserId: Boolean(context?.user_id),
          sourceCount: context?.sources?.length ?? 0,
          confidence: context?.confidence ?? null,
          source: context?.source ?? null,
          window: windowParam,
          requestIdPrefix: requestIdParam.slice(0, 8),
        },
      });
    } catch {
      // ignore
    }
    return NextResponse.json(response, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/context", code: "OPS_CASE_CONTEXT_FAIL" });
    return jsonError({ code: "OPS_CASE_CONTEXT_FAIL", message: "Unable to fetch context", requestId });
  }
}
