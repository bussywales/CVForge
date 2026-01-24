import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { verifyAckToken } from "@/lib/ops/alerts-ack-token";
import { recordAlertHandled } from "@/lib/ops/alerts-handled";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const budget = getRateLimitBudget("alerts_ack_public");
  const identifier = request.headers.get("x-forwarded-for") ?? "public";
  const limiter = checkRateLimit({
    route: "alerts_ack_public",
    identifier,
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
      meta: { limitKey: "alerts_ack_public", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const url = new URL(request.url);
  const token = typeof payload?.token === "string" ? payload.token : url.searchParams.get("token");
  if (!token) return jsonError({ code: "BAD_REQUEST", message: "token required", requestId, status: 400 });

  const verification = verifyAckToken(token);
  if (!verification.ok || !verification.payload?.eventId) {
    return jsonError({ code: "INVALID_TOKEN", message: "Invalid or expired token", requestId, status: 400 });
  }

  const actorId = `token_${verification.payload.eventId.slice(0, 6)}`;
  const result = await recordAlertHandled({ eventId: verification.payload.eventId, actorId, source: "token", note: null });
  const admin = createServiceRoleClient();
  await admin.from("ops_audit_log").insert({
    actor_user_id: null,
    target_user_id: null,
    action: result.ok ? "alerts_ack_public_success" : "alerts_ack_public_failed",
    meta: { eventId: verification.payload.eventId, requestId },
  });
  if (!result.ok) return jsonError({ code: "ACK_FAILED", message: "Unable to ack alert", requestId, status: 404 });
  return NextResponse.json({ ok: true, requestId, eventId: verification.payload.eventId, handled: true, deduped: Boolean(result.deduped) }, { headers });
}
