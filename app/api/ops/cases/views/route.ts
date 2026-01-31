import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  normaliseCaseQueueAssigned,
  normaliseCaseQueueBreached,
  normaliseCaseQueuePriority,
  normaliseCaseQueueSort,
  normaliseCaseQueueStatus,
  normaliseCaseQueueWindow,
} from "@/lib/ops/ops-case-queue";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaseViewPayload = {
  status: string;
  assigned: string;
  priority: string;
  breached: boolean;
  window: string;
  sort: string;
  q: string;
};

function parseViewPayload(raw: any): { view: CaseViewPayload } | { error: string } {
  const statusRaw = raw?.status;
  const assignedRaw = raw?.assigned;
  const priorityRaw = raw?.priority;
  const sortRaw = raw?.sort;
  const windowRaw = raw?.window;
  const breachedRaw = raw?.breached;

  const status = normaliseCaseQueueStatus(statusRaw) ?? (statusRaw ? null : "all");
  if (status === null) return { error: "Invalid status" };
  const assigned = normaliseCaseQueueAssigned(assignedRaw) ?? (assignedRaw ? null : "any");
  if (assigned === null) return { error: "Invalid assigned" };
  const priority = normaliseCaseQueuePriority(priorityRaw) ?? (priorityRaw ? null : "all");
  if (priority === null) return { error: "Invalid priority" };
  const sort = normaliseCaseQueueSort(sortRaw ?? null);
  const window = normaliseCaseQueueWindow(windowRaw ?? null);
  const breached =
    typeof breachedRaw === "boolean" ? breachedRaw : normaliseCaseQueueBreached(breachedRaw ?? null);
  const q = normaliseId(raw?.q ?? "");

  return {
    view: {
      status,
      assigned,
      priority,
      breached,
      window,
      sort,
      q,
    },
  };
}

function parseName(raw: any) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 64);
  if (!trimmed) return null;
  return trimmed;
}

async function requireOpsUser(request: Request, requestId: string) {
  const { user } = await getSupabaseUser();
  if (!user) return { error: jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 }) };
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return { error: jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const guard = await requireOpsUser(request, requestId);
  if ("error" in guard) return guard.error;

  const budget = getRateLimitBudget("ops_cases_views_list");
  const limiter = checkRateLimit({
    route: "ops_cases_views_list",
    identifier: guard.user.id,
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
      meta: { limitKey: "ops_cases_views_list", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("ops_case_views")
      .select("id,name,is_default,view,created_at,updated_at")
      .eq("user_id", guard.user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const views = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.is_default ?? false,
      view: row.view ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return NextResponse.json({ ok: true, requestId, views }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/views", code: "OPS_CASES_VIEWS_LIST_FAIL" });
    return jsonError({ code: "OPS_CASES_VIEWS_LIST_FAIL", message: "Unable to load views", requestId });
  }
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const guard = await requireOpsUser(request, requestId);
  if ("error" in guard) return guard.error;

  const budget = getRateLimitBudget("ops_cases_views_write");
  const limiter = checkRateLimit({
    route: "ops_cases_views_write",
    identifier: guard.user.id,
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
      meta: { limitKey: "ops_cases_views_write", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const name = parseName(body?.name);
  if (!name) return jsonError({ code: "BAD_REQUEST", message: "name required", requestId, status: 400 });
  const parsed = parseViewPayload(body?.view ?? body);
  if ("error" in parsed) return jsonError({ code: "BAD_REQUEST", message: parsed.error, requestId, status: 400 });

  try {
    const admin = createServiceRoleClient();
    const nowIso = new Date().toISOString();
    if (body?.isDefault) {
      await admin.from("ops_case_views").update({ is_default: false }).eq("user_id", guard.user.id);
    }
    const { data, error } = await admin
      .from("ops_case_views")
      .insert({
        user_id: guard.user.id,
        name,
        view: parsed.view,
        is_default: Boolean(body?.isDefault),
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,name,is_default,view,created_at,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        requestId,
        view: {
          id: data.id,
          name: data.name,
          isDefault: data.is_default ?? false,
          view: data.view ?? {},
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/views", code: "OPS_CASES_VIEWS_CREATE_FAIL" });
    return jsonError({ code: "OPS_CASES_VIEWS_CREATE_FAIL", message: "Unable to save view", requestId });
  }
}

export async function PATCH(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const guard = await requireOpsUser(request, requestId);
  if ("error" in guard) return guard.error;

  const budget = getRateLimitBudget("ops_cases_views_write");
  const limiter = checkRateLimit({
    route: "ops_cases_views_write",
    identifier: guard.user.id,
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
      meta: { limitKey: "ops_cases_views_write", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const id = normaliseId(body?.id);
  if (!id) return jsonError({ code: "BAD_REQUEST", message: "id required", requestId, status: 400 });

  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body?.name !== undefined) {
    const name = parseName(body?.name);
    if (!name) return jsonError({ code: "BAD_REQUEST", message: "Invalid name", requestId, status: 400 });
    payload.name = name;
  }
  if (body?.view !== undefined) {
    const parsed = parseViewPayload(body?.view ?? body);
    if ("error" in parsed) return jsonError({ code: "BAD_REQUEST", message: parsed.error, requestId, status: 400 });
    payload.view = parsed.view;
  }
  if (body?.isDefault === true) payload.is_default = true;
  if (body?.isDefault === false) payload.is_default = false;

  try {
    const admin = createServiceRoleClient();
    if (payload.is_default === true) {
      await admin.from("ops_case_views").update({ is_default: false }).eq("user_id", guard.user.id);
    }
    const { data, error } = await admin
      .from("ops_case_views")
      .update(payload)
      .eq("id", id)
      .eq("user_id", guard.user.id)
      .select("id,name,is_default,view,created_at,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json(
      {
        ok: true,
        requestId,
        view: {
          id: data.id,
          name: data.name,
          isDefault: data.is_default ?? false,
          view: data.view ?? {},
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/views", code: "OPS_CASES_VIEWS_UPDATE_FAIL" });
    return jsonError({ code: "OPS_CASES_VIEWS_UPDATE_FAIL", message: "Unable to update view", requestId });
  }
}

export async function DELETE(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const guard = await requireOpsUser(request, requestId);
  if ("error" in guard) return guard.error;

  const budget = getRateLimitBudget("ops_cases_views_write");
  const limiter = checkRateLimit({
    route: "ops_cases_views_write",
    identifier: guard.user.id,
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
      meta: { limitKey: "ops_cases_views_write", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const id = normaliseId(body?.id);
  if (!id) return jsonError({ code: "BAD_REQUEST", message: "id required", requestId, status: 400 });

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("ops_case_views").delete().eq("id", id).eq("user_id", guard.user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, requestId }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases/views", code: "OPS_CASES_VIEWS_DELETE_FAIL" });
    return jsonError({ code: "OPS_CASES_VIEWS_DELETE_FAIL", message: "Unable to delete view", requestId });
  }
}
