import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addNoStore(headers: Headers) {
  headers.set("cache-control", "no-store");
  return headers;
}

function withNoStoreResponse(res: Response) {
  res.headers.set("cache-control", "no-store");
  return res;
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  addNoStore(headers);
  const { user } = await getSupabaseUser();
  if (!user) {
    return withNoStoreResponse(jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 }));
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return withNoStoreResponse(jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 }));
  }

  const budget = getRateLimitBudget("ops_webhooks");
  const limiter = checkRateLimit({ route: "ops_webhooks", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "ops_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "ops_webhooks", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window") ?? url.searchParams.get("since");
  const sinceHours = windowParam === "7d" ? 24 * 7 : windowParam === "1h" ? 1 : windowParam === "15m" ? 0.25 : 24;
  const code = url.searchParams.get("code");
  const q = url.searchParams.get("q");
  const userId = url.searchParams.get("userId");
  const cursor = url.searchParams.get("cursor");
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  const { items, nextCursor } = await listWebhookFailures({
    sinceHours,
    code: code || null,
    q: q || null,
    userId: userId || null,
    cursor: cursor || null,
    limit,
  });

  return NextResponse.json({ ok: true, requestId, items, nextCursor }, { headers });
}
