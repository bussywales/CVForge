import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

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
  const { data: eventRow } = await admin.from("ops_alert_events").select("id,key,signals_masked").eq("id", eventId).limit(1).single();
  if (!eventRow) {
    return jsonError({ code: "NOT_FOUND", message: "Event not found", requestId, status: 404 });
  }

  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alerts_ack_submit",
    meta: { key: eventRow.key, eventId, source, requestId },
  });

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("application_activities")
    .select("id,body")
    .eq("type", "monetisation.ops_alert_handled")
    .gte("occurred_at", sinceIso)
    .like("body", `%\"eventId\":\"${eventId}\"%`)
    .limit(1);
  if (existing && existing.length) {
    await admin.from("ops_audit_log").insert({
      actor_user_id: user.id,
      target_user_id: null,
      action: "ops_alerts_ack_submit_deduped",
      meta: { key: eventRow.key, eventId, source, requestId },
    });
    return NextResponse.json({ ok: true, requestId, eventId, handled: true, deduped: true }, { headers });
  }

  const handledAt = new Date().toISOString();
  const bodyPayload = {
    eventId,
    alertKey: eventRow.key,
    source,
    note,
    actor: user.id,
    handledAt,
  };
  await admin.from("application_activities").insert({
    application_id: user.id,
    type: "monetisation.ops_alert_handled",
    subject: "ops_alert_handled",
    channel: "ops",
    body: JSON.stringify(sanitizeMonetisationMeta(bodyPayload)),
    occurred_at: handledAt,
    created_at: handledAt,
  });

  await admin.from("ops_audit_log").insert({
    actor_user_id: user.id,
    target_user_id: null,
    action: "ops_alerts_ack_submit_success",
    meta: { key: eventRow.key, eventId, source, requestId },
  });

  return NextResponse.json({ ok: true, requestId, eventId, handled: true }, { headers });
}
