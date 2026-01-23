import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { findInviteByToken } from "@/lib/early-access/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return jsonError({ code: "BAD_INPUT", message: "Missing token", requestId, status: 400 });
  }
  const budget = getRateLimitBudget("invite_validate");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limiter = checkRateLimit({ route: "invite_validate", identifier: ip, limit: budget.limit, windowMs: budget.windowMs, category: "user_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "invite_validate", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const invite = await findInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ ok: true, valid: false, reason: "not_found", requestId }, { headers });
    }
    const now = Date.now();
    if (invite.revoked_at) {
      return NextResponse.json({ ok: true, valid: false, reason: "revoked", requestId }, { headers });
    }
    if (invite.claimed_at) {
      return NextResponse.json({ ok: true, valid: false, reason: "claimed", requestId }, { headers });
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < now) {
      return NextResponse.json({ ok: true, valid: false, reason: "expired", requestId }, { headers });
    }
    return NextResponse.json({ ok: true, valid: true, requestId }, { headers });
  } catch {
    return jsonError({ code: "INVITE_VALIDATE_FAILED", message: "Unable to validate invite", requestId, status: 500 });
  }
}
