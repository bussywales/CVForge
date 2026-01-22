import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { claimInviteForUser, findInviteByToken } from "@/lib/early-access/invites";
import { hashEarlyAccessEmail } from "@/lib/early-access";
import { logMonetisationEvent } from "@/lib/monetisation";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const budget = getRateLimitBudget("invite_claim");
  const limiter = checkRateLimit({ route: "invite_claim", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "user_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "invite_claim", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : null;
  if (!token) {
    return jsonError({ code: "BAD_INPUT", message: "Missing token", requestId, status: 400 });
  }

  const emailHash = hashEarlyAccessEmail(user.email);
  const admin = createServiceRoleClient();
  try {
    await logMonetisationEvent(admin, user.id, "invite_attribution_claim_attempt", { meta: { token_prefix: token.slice(0, 6), email_hash_prefix: emailHash?.slice(0, 8) ?? null } });
  } catch {
    // ignore
  }

  try {
    const invite = await findInviteByToken(token);
    if (!invite) {
      return jsonError({ code: "INVITE_NOT_FOUND", message: "Invite not found", requestId, status: 404 });
    }
    const result = await claimInviteForUser({ email: user.email ?? "", userId: user.id, token });
    if (result.status === "claimed") {
      return NextResponse.json({ ok: true, status: "claimed", inviteId: result.inviteId, requestId }, { headers });
    }
    try {
      await logMonetisationEvent(admin, user.id, "invite_attribution_claim_already_claimed", { meta: { inviteId: invite.id, status: result.status } });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true, status: result.status, requestId }, { headers });
  } catch {
    try {
      await logMonetisationEvent(admin, user.id, "invite_attribution_claim_failed", { meta: { token_prefix: token.slice(0, 6) } });
    } catch {
      // ignore
    }
    return jsonError({ code: "INVITE_CLAIM_FAILED", message: "Unable to claim invite", requestId, status: 500 });
  }
}
