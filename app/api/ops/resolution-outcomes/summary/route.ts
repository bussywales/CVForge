import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/data/supabase";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { summariseResolutionOutcomes, type ResolutionOutcomeCode } from "@/lib/ops/ops-resolution-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const url = new URL(request.url);
  const windowParam = url.searchParams.get("window");
  const windowHours = windowParam === "7d" ? 24 * 7 : 24;
  const userId = url.searchParams.get("userId");
  const outcomeCode = (url.searchParams.get("outcomeCode") as ResolutionOutcomeCode | null) || null;

  const summary = await summariseResolutionOutcomes({ windowHours, userId: userId || null, outcomeCode });
  return NextResponse.json({ ok: true, requestId, summary }, { headers });
}
