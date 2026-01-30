import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { getCaseNotes, normaliseCaseType } from "@/lib/ops/ops-case-notes";
import { normaliseId } from "@/lib/ops/normalise-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_notes_get");
  const limiter = checkRateLimit({
    route: "ops_case_notes_get",
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
      meta: { limitKey: "ops_case_notes_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const caseType = normaliseCaseType(url.searchParams.get("caseType"));
  const caseKey = normaliseId(url.searchParams.get("caseKey"));
  const windowLabel = url.searchParams.get("window") ?? null;
  if (!caseType || !caseKey) {
    return jsonError({ code: "BAD_REQUEST", message: "caseType and caseKey required", requestId, status: 400 });
  }

  try {
    const notes = await getCaseNotes({ caseType, caseKey });
    return NextResponse.json(
      {
        ok: true,
        requestId,
        window: windowLabel,
        notes: notes
          ? {
              caseType: notes.case_type,
              caseKey: notes.case_key,
              windowLabel: notes.window_label ?? null,
              checklist: notes.checklist ?? {},
              outcomeCode: notes.outcome_code ?? null,
              notes: notes.notes ?? null,
              status: notes.status ?? "open",
              lastHandledAt: notes.last_handled_at ?? null,
              lastHandledBy: notes.last_handled_by ?? null,
              createdAt: notes.created_at,
              updatedAt: notes.updated_at,
            }
          : null,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/notes", code: "OPS_CASE_NOTES_FETCH_FAIL" });
    return jsonError({ code: "OPS_CASE_NOTES_FETCH_FAIL", message: "Unable to load case notes", requestId });
  }
}
