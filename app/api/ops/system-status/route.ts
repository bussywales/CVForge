import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { buildSystemStatus } from "@/lib/ops/system-status";

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

  try {
    const vercelId = request.headers.get("x-vercel-id");
    const matchedPath = request.headers.get("x-matched-path");
    const payload = await buildSystemStatus({ vercelId, matchedPath });
    return NextResponse.json({ ok: true, requestId, status: payload }, { headers });
  } catch (error) {
    return withNoStoreResponse(jsonError({ code: "SYSTEM_STATUS_ERROR", message: "Unable to load system status", requestId, status: 500 }));
  }
}
