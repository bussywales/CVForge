import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { getRecentIncidentEvents } from "@/lib/ops/incidents";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { resolveCaseWindow, windowToMs } from "@/lib/ops/ops-case-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const budget = getRateLimitBudget("ops_incidents_preview");
  const limiter = checkRateLimit({
    route: "ops_incidents_preview",
    identifier: user.id,
    limit: budget.limit,
    windowMs: budget.windowMs,
    category: "ops_action",
  });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_incidents_preview", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const windowParam = resolveCaseWindow(url.searchParams.get("window"));
  const requestIdFilter = url.searchParams.get("requestId");
  const userIdFilter = url.searchParams.get("userId");
  const limitParam = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 120) : 40;

  const windowMs = windowToMs(windowParam);
  const sinceDays = Math.max(1, Math.ceil(windowMs / (24 * 60 * 60 * 1000)));
  const incidents = await getRecentIncidentEvents({ limit: limit * 3, sinceDays });
  const cutoff = Date.now() - windowMs;
  const filtered = incidents.filter((incident) => {
    const ts = new Date(incident.at).getTime();
    if (Number.isNaN(ts) || ts < cutoff) return false;
    if (requestIdFilter && incident.requestId !== requestIdFilter) return false;
    if (userIdFilter && incident.userId !== userIdFilter) return false;
    return true;
  });

  return NextResponse.json(
    { ok: true, requestId, window: windowParam, count: filtered.length, items: filtered.slice(0, limit) },
    { headers }
  );
}
