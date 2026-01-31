import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { fetchApplicationPack, listPackVersions, updatePackStatus } from "@/lib/packs/packs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_get");
  const limiter = checkRateLimit({
    route: "packs_get",
    identifier: user.id,
    limit: budget.limit,
    windowMs: budget.windowMs,
    category: "monetisation",
  });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "packs_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const pack = await fetchApplicationPack({ supabase, userId: user.id, packId: params.id });
    if (!pack) {
      return jsonError({ code: "NOT_FOUND", message: "Pack not found", requestId, status: 404 });
    }
    const versions = await listPackVersions({ supabase, userId: user.id, packId: params.id, limit: 20 });
    return NextResponse.json({ ok: true, requestId, pack, versions }, { headers });
  } catch {
    return jsonError({ code: "PACK_GET_FAIL", message: "Unable to load pack", requestId });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_update");
  const limiter = checkRateLimit({
    route: "packs_update",
    identifier: user.id,
    limit: budget.limit,
    windowMs: budget.windowMs,
    category: "monetisation",
  });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "packs_update", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError({ code: "BAD_JSON", message: "Invalid JSON body", requestId, status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (status !== "archived") {
    return jsonError({ code: "BAD_INPUT", message: "Only archive is supported", requestId, status: 400 });
  }

  try {
    const pack = await updatePackStatus({ supabase, userId: user.id, packId: params.id, status: "archived" });
    return NextResponse.json({ ok: true, requestId, pack }, { headers });
  } catch {
    return jsonError({ code: "PACK_UPDATE_FAIL", message: "Unable to update pack", requestId });
  }
}
