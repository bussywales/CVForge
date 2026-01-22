import { NextResponse } from "next/server";
import { applyRequestIdHeaders, withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { captureServerError } from "@/lib/observability/sentry";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { computeDue, LATER_WINDOW_MS } from "@/lib/ops/resolution-effectiveness";
import { mapOutcomeRows, maskResolutionOutcome, type EffectivenessState } from "@/lib/ops/ops-resolution-outcomes";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

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

  const limiter = checkRateLimit({
    route: "ops_resolution_effectiveness",
    identifier: user.id,
    limit: 30,
    windowMs: 5 * 60 * 1000,
    category: "ops_action",
  });
  if (!limiter.allowed) {
    const res = jsonError({ code: "RATE_LIMITED", message: "Rate limited — try again shortly", requestId, status: 429 });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const resolutionOutcomeId = typeof body?.resolutionOutcomeId === "string" ? body.resolutionOutcomeId : null;
  const state = body?.state as EffectivenessState | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 120) : null;
  const note = typeof body?.note === "string" ? body.note.slice(0, 200) : null;
  const source = typeof body?.source === "string" ? body.source.slice(0, 80) : "ops_resolution_effectiveness";

  if (!resolutionOutcomeId) {
    return jsonError({ code: "MISSING_OUTCOME", message: "resolutionOutcomeId required", requestId, status: 400 });
  }
  if (state !== "unknown" && state !== "success" && state !== "fail") {
    return jsonError({ code: "INVALID_STATE", message: "Invalid state", requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const { data: existing, error: fetchError } = await admin
      .from("application_activities")
      .select("id,body,occurred_at,created_at")
      .eq("id", resolutionOutcomeId)
      .eq("type", "monetisation.ops_resolution_outcome_set")
      .single();
    if (fetchError || !existing) {
      return jsonError({ code: "NOT_FOUND", message: "Outcome not found", requestId, status: 404 });
    }

    let meta: Record<string, any> = {};
    try {
      meta = JSON.parse(existing.body ?? "{}");
    } catch {
      meta = {};
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const deferredUntil = state === "unknown" && reason === "later" ? new Date(now.getTime() + LATER_WINDOW_MS).toISOString() : null;
    const sanitized = sanitizeMonetisationMeta({
      effectivenessState: state,
      effectivenessReason: reason,
      effectivenessNote: note,
      effectivenessSource: source,
      effectivenessUpdatedAt: nowIso,
      effectivenessDeferredUntil: deferredUntil,
      effectivenessActorId: user.id,
    });

    const updatedMeta = {
      ...meta,
      ...sanitized,
      effectivenessState: state,
      effectivenessUpdatedAt: nowIso,
      effectivenessDeferredUntil: deferredUntil,
      effectivenessReason: typeof sanitized.effectivenessReason === "string" ? sanitized.effectivenessReason : reason,
      effectivenessNote: typeof sanitized.effectivenessNote === "string" ? sanitized.effectivenessNote : note,
      effectivenessSource: typeof sanitized.effectivenessSource === "string" ? sanitized.effectivenessSource : source,
    };

    const { data: updated, error: updateError } = await admin
      .from("application_activities")
      .update({ body: JSON.stringify(updatedMeta) })
      .eq("id", resolutionOutcomeId)
      .select("id,body,occurred_at,created_at")
      .single();
    if (updateError || !updated) {
      captureServerError(updateError ?? new Error("update_failed"), { requestId, route: "/api/ops/resolution-effectiveness", userId: user.id });
      return jsonError({ code: "UPDATE_FAILED", message: "Unable to save effectiveness", requestId, status: 500 });
    }

    const [parsed] = mapOutcomeRows([updated], now);
    if (!parsed) {
      return jsonError({ code: "PARSE_FAILED", message: "Unable to parse outcome", requestId, status: 500 });
    }

    return NextResponse.json({ ok: true, item: maskResolutionOutcome(parsed), requestId }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/resolution-effectiveness", userId: user?.id ?? "anon" });
    return jsonError({ code: "SERVER_ERROR", message: "Unable to save effectiveness", requestId, status: 500 });
  }
}

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

  const url = new URL(request.url);
  const due = url.searchParams.get("due") === "1";
  const rangeParam = url.searchParams.get("range");
  const windowHours = rangeParam === "7d" ? 24 * 7 : 24;
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 20;
  const cursorRaw = url.searchParams.get("cursor");
  const cursor = cursorRaw && !Number.isNaN(new Date(cursorRaw).getTime()) ? cursorRaw : null;

  try {
    const admin = createServiceRoleClient();
    const now = new Date();
    const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
    const fetchLimit = due ? Math.max(limit * 3, 120) : limit + 1;
    let query = admin
      .from("application_activities")
      .select("id,body,occurred_at,created_at")
      .eq("type", "monetisation.ops_resolution_outcome_set")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(fetchLimit);
    if (cursor) {
      query = query.lt("occurred_at", cursor);
    }
    const { data, error } = await query;
    if (error || !data) {
      return jsonError({ code: "FETCH_FAILED", message: "Unable to fetch outcomes", requestId, status: 500 });
    }
    const outcomes = mapOutcomeRows(data, now);
    if (due) {
      const { dueItems, insights } = computeDue(outcomes, now);
      return NextResponse.json(
        {
          ok: true,
          requestId,
          items: dueItems.slice(0, limit).map((o) => maskResolutionOutcome(o)),
          counts: { due: dueItems.length },
          insights,
        },
        { headers }
      );
    }
    const pageItems = outcomes.slice(0, limit);
    const hasMore = outcomes.length > limit;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.createdAt ?? null : null;
    return NextResponse.json(
      {
        ok: true,
        requestId,
        items: pageItems.map((o) => maskResolutionOutcome(o)),
        counts: { total: outcomes.length },
        nextCursor,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/resolution-effectiveness", userId: "ops" });
    return jsonError({ code: "SERVER_ERROR", message: "Unable to fetch outcomes", requestId, status: 500 });
  }
}
