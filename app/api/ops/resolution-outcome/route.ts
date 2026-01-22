import { NextResponse } from "next/server";
import { applyRequestIdHeaders, withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { logMonetisationEvent } from "@/lib/monetisation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { captureServerError } from "@/lib/observability/sentry";
import { buildOutcomeEvent, mapOutcomeRows, type ResolutionOutcomeCode } from "@/lib/ops/ops-resolution-outcomes";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("ops_resolution_outcome");
  const limiter = checkRateLimit({
    route: "ops_resolution_outcome",
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
      meta: { limitKey: "ops_resolution_outcome", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const code = body?.code as ResolutionOutcomeCode | undefined;
  const note = typeof body?.note === "string" ? body.note : null;
  const targetRequestId = typeof body?.requestId === "string" ? body.requestId : null;
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;

  if (!code) {
    return jsonError({ code: "INVALID_CODE", message: "Resolution code required", requestId, status: 400 });
  }
  if (!targetRequestId && !targetUserId) {
    return jsonError({ code: "MISSING_TARGET", message: "requestId or userId required", requestId, status: 400 });
  }
  if (note && note.length > 200) {
    return jsonError({ code: "NOTE_TOO_LONG", message: "Note must be 200 characters or fewer", requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const payload = buildOutcomeEvent({
      code,
      note,
      requestId: targetRequestId,
      userId: targetUserId,
      actorId: user.id,
      actorEmail: user.email,
    });
    const activity = await logMonetisationEvent(admin, user.id, "ops_resolution_outcome_set", payload);
    const parsed = activity ? mapOutcomeRows([activity], new Date())[0] : null;
    return NextResponse.json({ ok: true, item: parsed ?? null }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/resolution-outcome", userId: user.id, code: "OUTCOME_SET_FAIL" });
    return jsonError({ code: "OUTCOME_SET_FAIL", message: "Unable to save resolution outcome", requestId });
  }
}
