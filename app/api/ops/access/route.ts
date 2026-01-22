import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { getEarlyAccessDecision, getEarlyAccessRecord, hashEarlyAccessEmail } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value?: string | null) {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);
}

function isEmail(value?: string | null) {
  if (!value) return false;
  return /\S+@\S+\.\S+/.test(value);
}

async function findUserByEmail(admin: ReturnType<typeof createServiceRoleClient>, email: string) {
  const perPage = 200;
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const match = (data?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (match) return match;
    lastPage = Number(data?.lastPage ?? page);
    if (!lastPage || Number.isNaN(lastPage)) lastPage = page;
    page += 1;
  }
  return null;
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
  const email = url.searchParams.get("email");
  if (!isUuid(targetUser) && !isEmail(email)) {
    return jsonError({ code: "BAD_INPUT", message: "Invalid email or userId", requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (targetUser && isUuid(targetUser)) {
      const { data: targetUserInfo } = await admin.auth.admin.getUserById(targetUser);
      userId = targetUserInfo?.user?.id ?? targetUser;
      userEmail = targetUserInfo?.user?.email ?? null;
    } else if (email) {
      const found = await findUserByEmail(admin, email);
      userId = found?.id ?? null;
      userEmail = found?.email ?? email;
    }

    const decision = await getEarlyAccessDecision({ userId: userId ?? user.id, email: userEmail ?? email ?? null });
    const record = userId ? await getEarlyAccessRecord(userId) : null;
    let inviteRecord: any = null;
    const emailHash = hashEarlyAccessEmail(userEmail ?? email ?? null);
    if (emailHash) {
      const { data } = await admin
        .from("early_access_allowlist")
        .select("invited_at, revoked_at, note, user_id")
        .eq("email_hash", emailHash)
        .order("invited_at", { ascending: false })
        .limit(1);
      inviteRecord = data?.[0] ?? null;
    }
    return NextResponse.json(
      {
        ok: true,
        userFound: Boolean(userId),
        userId,
        allowedNow: decision.allowed,
        source: decision.source,
        record: record
          ? { grantedAt: record.granted_at, revokedAt: record.revoked_at, note: record.note ?? null }
          : inviteRecord
            ? { grantedAt: inviteRecord.invited_at, revokedAt: inviteRecord.revoked_at, note: inviteRecord.note ?? null }
            : null,
        dbInviteActive: inviteRecord ? !inviteRecord.revoked_at : false,
        requestId,
      },
      { headers }
    );
  } catch {
    return jsonError({ code: "ACCESS_LOOKUP_FAILED", message: "Unable to load access", requestId, status: 500 });
  }
}
