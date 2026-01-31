import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createApplicationPack, listApplicationPacks } from "@/lib/packs/packs-store";
import { logMonetisationEvent } from "@/lib/monetisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE_MAX = 120;
const COMPANY_MAX = 120;
const ROLE_MAX = 120;

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_list");
  const limiter = checkRateLimit({
    route: "packs_list",
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
      meta: { limitKey: "packs_list", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const url = new URL(request.url);
    let limit = Number(url.searchParams.get("limit") ?? 24);
    if (Number.isNaN(limit) || limit <= 0) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid limit", requestId, status: 400 });
    }
    limit = Math.min(limit, 50);
    const cursor = url.searchParams.get("cursor");

    const packs = await listApplicationPacks({ supabase, userId: user.id, limit, cursor });
    const nextCursor = packs.length === limit ? packs[packs.length - 1]?.updatedAt ?? null : null;
    return NextResponse.json({ ok: true, requestId, packs, nextCursor }, { headers });
  } catch (error) {
    return jsonError({ code: "PACKS_LIST_FAIL", message: "Unable to load packs", requestId });
  }
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_create");
  const limiter = checkRateLimit({
    route: "packs_create",
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
      meta: { limitKey: "packs_create", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError({ code: "BAD_JSON", message: "Invalid JSON body", requestId, status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, TITLE_MAX) : "";
  const company = typeof body.company === "string" ? body.company.trim().slice(0, COMPANY_MAX) : null;
  const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim().slice(0, ROLE_MAX) : null;
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 40) : null;

  if (!title) {
    return jsonError({ code: "BAD_INPUT", message: "Title is required", requestId, status: 400 });
  }

  try {
    const pack = await createApplicationPack({
      supabase,
      userId: user.id,
      title,
      company,
      roleTitle,
      source,
    });
    try {
      await logMonetisationEvent(supabase, user.id, "pack_created", {
        surface: "packs",
        meta: { packId: pack.id, titleLength: title.length },
      });
    } catch {
      // ignore logging failures
    }
    return NextResponse.json({ ok: true, requestId, pack }, { headers });
  } catch {
    return jsonError({ code: "PACK_CREATE_FAIL", message: "Unable to create pack", requestId });
  }
}
