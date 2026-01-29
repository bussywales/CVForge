import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_SET = new Set(["sent", "delivered", "failed"]);

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

  const budget = getRateLimitBudget("ops_alerts_deliveries_get");
  const limiter = checkRateLimit({ route: "ops_alerts_deliveries_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_alerts_deliveries_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const eventId = typeof url.searchParams.get("eventId") === "string" ? url.searchParams.get("eventId")?.trim() : null;
  const status = typeof url.searchParams.get("status") === "string" ? url.searchParams.get("status")?.trim() : null;
  const isTest = url.searchParams.get("isTest") === "1";

  const admin = createServiceRoleClient();
  let deliveryQuery = admin
    .from("ops_alert_delivery")
    .select("id,event_id,status,at,masked_reason,provider_ref,window_label,created_at")
    .order("at", { ascending: false })
    .limit(20);
  if (eventId) {
    deliveryQuery = deliveryQuery.eq("event_id", eventId);
  }
  if (status && STATUS_SET.has(status)) {
    deliveryQuery = deliveryQuery.eq("status", status);
  }
  const { data: deliveryRows, error: deliveryError } = await deliveryQuery;
  if (deliveryError) {
    return jsonError({ code: "DELIVERIES_FETCH_FAILED", message: "Unable to load deliveries", requestId, status: 500 });
  }

  const eventIds = Array.from(new Set((deliveryRows ?? []).map((row: any) => row.event_id).filter(Boolean)));
  let eventMap: Record<string, { summary: string; signals?: Record<string, any>; windowLabel?: string | null; key?: string | null }> = {};
  if (eventIds.length) {
    const { data: eventRows } = await admin
      .from("ops_alert_events")
      .select("id,key,summary_masked,signals_masked,window_label")
      .in("id", eventIds);
    eventMap = (eventRows ?? []).reduce<Record<string, { summary: string; signals?: Record<string, any>; windowLabel?: string | null; key?: string | null }>>((acc, row: any) => {
      if (row?.id) {
        acc[row.id] = {
          summary: row.summary_masked ?? "",
          signals: row.signals_masked && typeof row.signals_masked === "object" ? row.signals_masked : {},
          windowLabel: row.window_label ?? null,
          key: row.key ?? null,
        };
      }
      return acc;
    }, {});
  }

  const attempts: Record<string, number> = {};
  const deliveries = (deliveryRows ?? []).reduce<any[]>((acc, row: any) => {
    const eventIdValue = row.event_id;
    const event = eventMap[eventIdValue] ?? null;
    const signals = event?.signals ?? {};
    const rowIsTest = Boolean((signals as any).is_test ?? (signals as any).test ?? false);
    if (isTest && !rowIsTest) return acc;
    attempts[eventIdValue] = (attempts[eventIdValue] ?? 0) + 1;
    const reason = typeof row.masked_reason === "string" ? row.masked_reason.slice(0, 120) : null;
    acc.push({
      deliveryId: String(row.id),
      eventId: String(eventIdValue),
      createdAt: row.at ?? row.created_at ?? null,
      status: row.status,
      attempt: attempts[eventIdValue],
      isTest: rowIsTest,
      window_label: row.window_label ?? event?.windowLabel ?? null,
      headline: event?.summary ?? event?.key ?? "Alert",
      reason,
      requestId: null,
    });
    return acc;
  }, []);

  return NextResponse.json({ ok: true, requestId, deliveries }, { headers });
}
