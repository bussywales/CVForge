import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { claimAlert } from "@/lib/ops/alerts-ownership";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_claim");
  const limiter = checkRateLimit({
    route: "ops_alerts_claim",
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
      meta: { limitKey: "ops_alerts_claim", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const alertKey = typeof body?.alertKey === "string" ? body.alertKey : null;
  const windowLabel = typeof body?.windowLabel === "string" ? body.windowLabel : "15m";
  const eventId = typeof body?.eventId === "string" ? body.eventId : null;
  const noteRaw = typeof body?.note === "string" ? body.note : null;
  if (!alertKey) return jsonError({ code: "INVALID_ALERT", message: "alertKey required", requestId, status: 400 });

  try {
    const note = sanitizeMonetisationMeta({ note: noteRaw ?? null }).note ?? noteRaw ?? null;
    const result = await claimAlert({ alertKey, windowLabel, eventId, actorId: user.id, note });
    return NextResponse.json({ ok: true, requestId, ownership: { ...result, claimedBy: user.id, note } }, { headers });
  } catch (error) {
    return jsonError({ code: "CLAIM_FAILED", message: "Unable to claim alert", requestId, status: 500 });
  }
}
