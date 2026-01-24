import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { signAckToken } from "@/lib/ops/alerts-ack-token";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_ack_token");
  const limiter = checkRateLimit({ route: "ops_alerts_ack_token", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_ack_token", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }
  const eventId = typeof body?.eventId === "string" && body.eventId.trim() ? body.eventId.trim() : null;
  if (!eventId) return jsonError({ code: "BAD_REQUEST", message: "eventId required", requestId, status: 400 });

  const admin = createServiceRoleClient();
  const { data: eventRow } = await admin.from("ops_alert_events").select("id,window_label").eq("id", eventId).limit(1).single();
  if (!eventRow) return jsonError({ code: "NOT_FOUND", message: "Event not found", requestId, status: 404 });

  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = signAckToken({ eventId, exp, window_label: eventRow.window_label ?? "15m" });

  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alerts_ack_token_created",
    meta: { eventId, requestId },
  });

  return NextResponse.json({ ok: true, requestId, token, eventId, exp }, { headers });
}
