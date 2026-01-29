import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { deactivateScenario } from "@/lib/ops/training-scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const mapScenario = (row: any) => ({
  id: row.id,
  createdAt: row.created_at,
  createdBy: row.created_by,
  scenarioType: row.scenario_type,
  windowLabel: row.window_label ?? "15m",
  eventId: row.event_id ?? null,
  requestId: row.request_id ?? null,
  meta: row.meta && typeof row.meta === "object" ? row.meta : {},
  isActive: Boolean(row.is_active ?? true),
});

export async function POST(request: Request, { params }: { params: { id?: string } }) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("ops_training_scenarios_deactivate");
  const limiter = checkRateLimit({ route: "ops_training_scenarios_deactivate", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_training_scenarios_deactivate", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id || !UUID_REGEX.test(id)) {
    return jsonError({ code: "BAD_REQUEST", message: "Invalid scenario id", requestId, status: 400 });
  }

  try {
    const scenario = await deactivateScenario({ id });
    return NextResponse.json({ ok: true, requestId, scenario: mapScenario(scenario) }, { headers });
  } catch {
    return jsonError({ code: "SCENARIO_DEACTIVATE_FAILED", message: "Unable to deactivate scenario", requestId, status: 500 });
  }
}
