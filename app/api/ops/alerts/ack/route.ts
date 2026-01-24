import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { recordAlertHandled } from "@/lib/ops/alerts-handled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeNote(note?: string | null) {
  if (!note) return null;
  const trimmed = note.replace(/\s+/g, " ").trim().slice(0, 200);
  const urlPattern = /https?:\/\/\S+/gi;
  return trimmed.replace(urlPattern, "[url-redacted]");
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_alerts_ack");
  const limiter = checkRateLimit({ route: "ops_alerts_ack", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_ack", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
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
  const sourceRaw = typeof body?.source === "string" ? body.source : "webhook";
  const source = ["webhook", "slack", "teams", "other"].includes(sourceRaw) ? sourceRaw : "webhook";
  const note = sanitizeNote(typeof body?.note === "string" ? body.note : null);
  if (!eventId) {
    return jsonError({ code: "BAD_REQUEST", message: "eventId required", requestId, status: 400 });
  }

  const admin = createServiceRoleClient();
  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alerts_ack_submit",
    meta: { eventId, source, requestId },
  });
  const result = await recordAlertHandled({ eventId, actorId: user.id, source, note });
  if (!result.ok) return jsonError({ code: result.code ?? "ACK_FAILED", message: "Unable to ack alert", requestId, status: 404 });
  if (result.deduped) {
    await admin.from("ops_audit_log").insert({
      actor_user_id: user.id,
      target_user_id: null,
      action: "ops_alerts_ack_submit_deduped",
      meta: { key: result.eventKey, eventId, source, requestId },
    });
    return NextResponse.json({ ok: true, requestId, eventId, handled: true, deduped: true }, { headers });
  }
  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alerts_ack_submit_success",
    meta: { key: result.eventKey, eventId, source, requestId },
  });

  return NextResponse.json({ ok: true, requestId, eventId, handled: true }, { headers });
}
