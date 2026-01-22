import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createInvite, buildInviteLink } from "@/lib/early-access/invites";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logMonetisationEvent } from "@/lib/monetisation";
import { hashEarlyAccessEmail } from "@/lib/early-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmail(value?: string | null) {
  if (!value) return false;
  return /\S+@\S+\.\S+/.test(value);
}

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

  const budget = getRateLimitBudget("ops_access_invite_create");
  const limiter = checkRateLimit({ route: "ops_access_invite_create", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_access_invite_create", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  if (!isEmail(email)) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid email", requestId, status: 400 });
  }

  try {
    const { token, invite } = await createInvite({ email, invitedBy: user.id });
    const link = buildInviteLink(token);
    const supabase = createServiceRoleClient();
    const hashedEmail = hashEarlyAccessEmail(email);
    try {
      await supabase.from("ops_audit_log").insert({
        actor_user_id: user.id,
        action: "early_access_invite_create",
        meta: { hashedEmailPrefix: hashedEmail ? hashedEmail.slice(0, 8) : null, requestId },
      });
      await logMonetisationEvent(supabase, user.id, "ops_early_access_invite_create", { meta: { hashedEmailPrefix: hashedEmail ? hashedEmail.slice(0, 8) : null } });
    } catch {
      // ignore audit/log failures
    }
    return NextResponse.json(
      {
        ok: true,
        invite: {
          status: invite.revoked_at ? "revoked" : invite.claimed_at ? "claimed" : "pending",
          invitedAt: invite.invited_at,
          claimedAt: invite.claimed_at,
          revokedAt: invite.revoked_at,
          expiresAt: invite.expires_at,
          token,
          emailHashPrefix: hashedEmail ? hashedEmail.slice(0, 8) : null,
        },
        link,
        requestId,
      },
      { headers }
    );
  } catch {
    return jsonError({ code: "ACCESS_INVITE_FAILED", message: "Unable to create invite", requestId, status: 500 });
  }
}
