import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { addWatch, listWatch } from "@/lib/ops/ops-watch";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const body = await request.json().catch(() => ({}));
  const requestIdInput = typeof body?.requestId === "string" ? body.requestId : null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const reasonCode = typeof body?.reasonCode === "string" ? body.reasonCode : null;
  const note = typeof body?.note === "string" ? body.note : null;
  const ttlHours = Number(body?.ttlHours ?? 24);

  if (!requestIdInput) return jsonError({ code: "REQUEST_ID_REQUIRED", message: "requestId required", requestId, status: 400 });
  if (!reasonCode) return jsonError({ code: "REASON_REQUIRED", message: "reasonCode required", requestId, status: 400 });
  if (![24, 48, 72].includes(ttlHours)) return jsonError({ code: "INVALID_TTL", message: "ttlHours must be 24|48|72", requestId, status: 400 });

  try {
    const result = await addWatch({ requestId: requestIdInput, userId, reasonCode, note: note ?? undefined, ttlHours, actorId: user.id });
    return NextResponse.json({ ok: true, expiresAt: result.expiresAt }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/watch", code: "WATCH_ADD_FAIL", userId: user.id });
    return jsonError({ code: "WATCH_ADD_FAIL", message: "Unable to add watch", requestId });
  }
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") !== "0";
  const windowParam = url.searchParams.get("window");
  const windowHours = windowParam === "7d" ? 24 * 7 : 24;
  const userId = url.searchParams.get("userId");

  const records = await listWatch({ activeOnly, windowHours, userId: userId || undefined });
  return NextResponse.json({ ok: true, requestId, records }, { headers });
}
