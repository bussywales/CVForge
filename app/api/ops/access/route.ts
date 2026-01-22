import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { getEarlyAccessDecision, getEarlyAccessRecord } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value?: string | null) {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }
  const budget = getRateLimitBudget("ops_access_get");
  const limiter = checkRateLimit({ route: "ops_access_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_access_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const targetUser = url.searchParams.get("userId");
  if (!isUuid(targetUser)) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid userId", requestId, status: 400 });
  }

  const userId = targetUser as string;

  try {
    const admin = createServiceRoleClient();
    const { data: targetUserInfo } = await admin.auth.admin.getUserById(userId);
    const decision = await getEarlyAccessDecision({ userId, email: targetUserInfo?.user?.email ?? null });
    const record = await getEarlyAccessRecord(userId);
    return NextResponse.json(
      {
        ok: true,
        userId,
        allowed: decision.allowed,
        reason: decision.reason,
        record: record ? { grantedAt: record.granted_at, revokedAt: record.revoked_at, note: record.note ?? null } : null,
        requestId,
      },
      { headers }
    );
  } catch {
    return jsonError({ code: "ACCESS_LOOKUP_FAILED", message: "Unable to load access", requestId, status: 500 });
  }
}
