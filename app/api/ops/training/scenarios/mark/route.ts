import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { markTrainingScenarioAcknowledged } from "@/lib/ops/training-scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mapScenario = (row: any) => ({
  id: row.id,
  createdAt: row.created_at,
  createdBy: row.created_by,
  scenarioType: row.scenario_type,
  windowLabel: row.window_label ?? "15m",
  eventId: row.event_id ?? null,
  requestId: row.request_id ?? null,
  acknowledgedAt: row.acknowledged_at ?? null,
  ackRequestId: row.ack_request_id ?? null,
  meta: row.meta && typeof row.meta === "object" ? row.meta : {},
  isActive: Boolean(row.is_active ?? true),
});

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

  const budget = getRateLimitBudget("ops_training_scenarios_mark");
  const limiter = checkRateLimit({ route: "ops_training_scenarios_mark", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_training_scenarios_mark", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const scenarioId = typeof body?.scenarioId === "string" ? body.scenarioId.trim() : "";
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const ackRequestId = typeof body?.ackRequestId === "string" ? body.ackRequestId.trim() : null;
  if (!scenarioId && !eventId) {
    return jsonError({ code: "BAD_REQUEST", message: "Missing scenario reference", requestId, status: 400 });
  }

  try {
    const scenario = await markTrainingScenarioAcknowledged({
      scenarioId: scenarioId || null,
      eventId: eventId || null,
      ackRequestId,
      now: new Date(),
    });
    return NextResponse.json({ ok: true, requestId, scenario: mapScenario(scenario) }, { headers });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Unable to mark training scenario";
    const status = message.includes("not found") ? 404 : 500;
    const code = status === 404 ? "NOT_FOUND" : "SCENARIO_MARK_FAILED";
    return jsonError({ code, message: status === 404 ? "Training scenario not found" : "Unable to mark training scenario", requestId, status });
  }
}
