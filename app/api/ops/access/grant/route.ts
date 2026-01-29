import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { grantEarlyAccess, hashEarlyAccessEmail } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value?: string | null) {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);
}

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
  const budget = getRateLimitBudget("ops_access_grant");
  const limiter = checkRateLimit({ route: "ops_access_grant", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_access_grant", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const targetUser = typeof body?.userId === "string" ? body.userId : null;
  const email = typeof body?.email === "string" ? body.email : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 120) : null;
  if (!isEmail(email)) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid email", requestId, status: 400 });
  }
  if (targetUser && !isUuid(targetUser)) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid userId", requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const record = await grantEarlyAccess({ userId: targetUser, email, grantedBy: user.id, note });
    const hashedEmail = hashEarlyAccessEmail(email);
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: targetUser,
      action: "early_access_grant",
      meta: { note: record.note ?? null, requestId, source: "ops_ui", hashedEmailPrefix: hashedEmail ? hashedEmail.slice(0, 8) : null },
    });
    return NextResponse.json(
      {
        ok: true,
        userId: targetUser,
        email,
        record: { grantedAt: record.granted_at ?? record.invited_at, revokedAt: record.revoked_at, note: record.note ?? null },
        requestId,
      },
      { headers }
    );
  } catch {
    return jsonError({ code: "ACCESS_GRANT_FAILED", message: "Unable to grant access", requestId, status: 500 });
  }
}
