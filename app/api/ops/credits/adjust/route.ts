import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole, isAdminRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserCredits } from "@/lib/data/credits";
import { normaliseReason, validateCreditPayload } from "@/lib/ops/credit-adjust";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        reason: normaliseReason(reason!),
        ref: `ops_${user.id}`,
      })
      .select("id")
      .single();
    if (error) throw error;

    const balance = await getUserCredits(admin, targetUserId!);
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId,
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
