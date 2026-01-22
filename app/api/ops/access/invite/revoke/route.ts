import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { revokeInvite } from "@/lib/early-access/invites";
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

  const budget = getRateLimitBudget("ops_access_invite_revoke");
  const limiter = checkRateLimit({ route: "ops_access_invite_revoke", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_access_invite_revoke", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const token = typeof body?.token === "string" ? body.token.trim() : null;

  if (!isEmail(email) && !token) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid email or token", requestId, status: 400 });
  }

  try {
    await revokeInvite({ emailHash: email ? hashEarlyAccessEmail(email) ?? undefined : undefined, token });
    const supabase = createServiceRoleClient();
    try {
      await supabase.from("ops_audit_log").insert({
        actor_user_id: user.id,
        action: "early_access_invite_revoke",
        meta: { hashedEmailPrefix: email ? hashEarlyAccessEmail(email)?.slice(0, 8) ?? null : null, requestId },
      });
      await logMonetisationEvent(supabase, user.id, "ops_early_access_invite_revoke", {
        meta: { hashedEmailPrefix: email ? hashEarlyAccessEmail(email)?.slice(0, 8) ?? null : null },
      });
    } catch {
      // ignore logging
    }
    return NextResponse.json({ ok: true, requestId }, { headers });
  } catch {
    return jsonError({ code: "ACCESS_INVITE_REVOKE_FAILED", message: "Unable to revoke invite", requestId, status: 500 });
  }
}
