import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole, isAdminRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserCredits } from "@/lib/data/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreditPayload = { userId: string | null; amount: number; reason: string | null; note: string | null };
const allowedReasons = ["Goodwill", "Refund", "Manual correction"] as const;
export function validateCreditPayload({ userId, amount, reason, note }: CreditPayload) {
  if (!userId) {
    return { ok: false, code: "INVALID_USER", message: "User is required." };
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be an integer between -500 and 500, not zero." };
  }
  if (!reason || !allowedReasons.includes(reason as (typeof allowedReasons)[number])) {
    return { ok: false, code: "INVALID_REASON", message: "Reason is required." };
  }
  if (note && note.length > 140) {
    return { ok: false, code: "INVALID_NOTE", message: "Note too long." };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role) || !isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;
  const amount = Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason : null;
  const note = typeof body?.note === "string" ? body.note : null;

  const validation = validateCreditPayload({ userId: targetUserId, amount, reason, note });
  if (!validation.ok) {
    return jsonError({ code: validation.code, message: validation.message, requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data: ledgerRow, error } = await admin
      .from("credit_ledger")
      .insert({
        user_id: targetUserId,
        delta: amount,
        reason: reason.toLowerCase().replace(" ", "_"),
        ref: `ops_${user.id}`,
      })
      .select("id")
      .single();
    if (error) throw error;

    const balance = await getUserCredits(admin, targetUserId);
    await admin.from("ops_audit_log").insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      action: "credit_adjust",
      meta: {
        amount,
        reason,
        note,
        requestId,
      },
    });

    return NextResponse.json({ ok: true, newBalance: balance, ledgerRef: ledgerRow.id }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/credits/adjust", userId: user.id, code: "CREDIT_ADJUST_FAIL" });
    return jsonError({ code: "CREDIT_ADJUST_FAIL", message: "Unable to adjust credits", requestId });
  }
}
