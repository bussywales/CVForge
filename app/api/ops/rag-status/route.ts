import { NextResponse } from "next/server";
import { applyRequestIdHeaders, withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildRagStatus } from "@/lib/ops/rag-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window");
  const trendParam = url.searchParams.get("trend");
  const windowMinutes = windowParam === "15m" ? 15 : Number(windowParam);
  const trendHours = trendParam === "24h" ? 24 : Number(trendParam);

  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const limiter = checkRateLimit({
    route: "ops_rag_status",
    identifier: user.id,
    limit: 40,
    windowMs: 5 * 60 * 1000,
    category: "ops_action",
  });
  if (!limiter.allowed) {
    const res = jsonError({ code: "RATE_LIMITED", message: "Rate limited — try again shortly", requestId, status: 429 });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const rag = await buildRagStatus({
      windowMinutes: Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 15,
      trendHours: Number.isFinite(trendHours) && trendHours > 0 ? trendHours : 24,
    });
    return NextResponse.json({ ok: true, rag, requestId }, { headers });
  } catch {
    return jsonError({ code: "RAG_ERROR", message: "Unable to load system health", requestId, status: 500 });
  }
}
