import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";

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

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const sinceHours = sinceParam === "7d" ? 24 * 7 : sinceParam === "1h" ? 1 : sinceParam === "15m" ? 0.25 : 24;
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
