import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createOpsAlertTestEvent } from "@/lib/ops/ops-alerts-test-event";
import { createTrainingScenario, listTrainingScenarios, type TrainingScenarioType } from "@/lib/ops/training-scenarios";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { upsertRequestContext } from "@/lib/ops/ops-request-context";
import { getCaseNotes, upsertCaseNotes } from "@/lib/ops/ops-case-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<TrainingScenarioType>(["alerts_test", "mixed_basic"]);

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

  const budget = getRateLimitBudget("ops_training_scenarios_get");
  const limiter = checkRateLimit({ route: "ops_training_scenarios_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_training_scenarios_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const activeOnly = url.searchParams.get("active") !== "0";
  const limitParam = url.searchParams.get("limit");
  const scope = url.searchParams.get("scope");
  let limit = Number(limitParam ?? 20);
  if (!Number.isFinite(limit) || limit <= 0) {
    limit = 20;
  }
  limit = Math.min(50, limit);
  const allowAll = scope === "all" && isAdminRole(roleInfo.role);
  const scenarios = await listTrainingScenarios({
    userId: allowAll ? null : user.id,
    limit,
    type: type ? type.trim() : null,
    activeOnly,
  });

  return NextResponse.json({ ok: true, requestId, scenarios: scenarios.map(mapScenario) }, { headers });
}

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

  const budget = getRateLimitBudget("ops_training_scenarios_post");
  const limiter = checkRateLimit({ route: "ops_training_scenarios_post", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_training_scenarios_post", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }
  const scenarioType = typeof body?.scenarioType === "string" ? body.scenarioType.trim() : "";
  if (!VALID_TYPES.has(scenarioType as TrainingScenarioType)) {
    return jsonError({ code: "BAD_REQUEST", message: "Unknown scenario type", requestId, status: 400 });
  }

  const now = new Date();
  let eventId: string | null = null;
  try {
    const created = await createOpsAlertTestEvent({ actorUserId: user.id, requestId, now });
    eventId = created.eventId ?? null;
  } catch {
    return jsonError({ code: "SCENARIO_CREATE_FAILED", message: "Unable to create training scenario", requestId, status: 500 });
  }

  if (scenarioType === "mixed_basic") {
    const admin = createServiceRoleClient();
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: null,
      action: "ops_training_scenario_mixed",
      meta: sanitizeMonetisationMeta({ requestId, eventId, scenarioType }),
    });
  }

  const scenario = await createTrainingScenario({
    type: scenarioType as TrainingScenarioType,
    userId: user.id,
    now,
    windowLabel: "15m",
    eventId,
    requestId,
    meta: {},
  });

  if (requestId) {
    try {
      await upsertRequestContext({
        requestId,
        userId: user.id,
        source: "training",
        confidence: "high",
        path: "/api/ops/training/scenarios",
        meta: { scenarioType, eventId },
        evidence: { scenarioType, eventId },
      });
    } catch {
      // best-effort only
    }
    try {
      const existingNotes = await getCaseNotes({ caseType: "request", caseKey: requestId });
      await upsertCaseNotes({
        caseType: "request",
        caseKey: requestId,
        patch: { outcome_code: existingNotes?.outcome_code ?? "training_only" },
        actorId: user.id,
        windowLabel: "15m",
      });
    } catch {
      // best-effort only
    }
  }

  return NextResponse.json({ ok: true, requestId, scenario: mapScenario(scenario) }, { headers });
}
