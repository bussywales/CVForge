import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { captureServerError } from "@/lib/observability/sentry";
import {
  decodeCaseQueueCursor,
  encodeCaseQueueCursor,
  getWindowFromIso,
  normaliseCaseQueueAssigned,
  normaliseCaseQueueBreached,
  normaliseCaseQueuePriority,
  normaliseCaseQueueQuery,
  normaliseCaseQueueSort,
  normaliseCaseQueueStatus,
  normaliseCaseQueueWindow,
  resolveCaseLastTouched,
} from "@/lib/ops/ops-case-queue";
import { computeCaseSla } from "@/lib/ops/ops-case-sla";
import { normaliseCasePriority } from "@/lib/ops/ops-case-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_cases_list");
  const limiter = checkRateLimit({
    route: "ops_cases_list",
    identifier: user.id,
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
      meta: { limitKey: "ops_cases_list", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const url = new URL(request.url);
    const statusParam = normaliseCaseQueueStatus(url.searchParams.get("status"));
    if (!statusParam) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid status filter", requestId, status: 400 });
    }
    const assignedParam = normaliseCaseQueueAssigned(url.searchParams.get("assigned"));
    if (!assignedParam) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid assigned filter", requestId, status: 400 });
    }
    const priorityParam = normaliseCaseQueuePriority(url.searchParams.get("priority"));
    if (!priorityParam) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid priority filter", requestId, status: 400 });
    }
    const sort = normaliseCaseQueueSort(url.searchParams.get("sort"));
    const window = normaliseCaseQueueWindow(url.searchParams.get("window"));
    const { fromIso } = getWindowFromIso(window);
    const breachedOnly = normaliseCaseQueueBreached(url.searchParams.get("breached"));
    const search = normaliseCaseQueueQuery(url.searchParams.get("q"));
    let requestIdsFilter: string[] | null = null;
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = decodeCaseQueueCursor(cursorRaw);
    if (cursorRaw && !cursor) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid cursor", requestId, status: 400 });
    }
    let limit = Number(url.searchParams.get("limit") ?? 50);
    if (Number.isNaN(limit) || limit <= 0) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid limit", requestId, status: 400 });
    }
    limit = Math.min(limit, 100);

    const admin = createServiceRoleClient();
    const now = new Date();
    const nowIso = now.toISOString();

    if (search.kind === "userId" && search.value) {
      const { data: contextRows, error: contextError } = await admin
        .from("ops_request_context")
        .select("request_id")
        .eq("user_id", search.value)
        .limit(200);
      if (contextError) throw contextError;
      const requestIds = (contextRows ?? []).map((row) => row.request_id);
      if (!requestIds.length) {
        return NextResponse.json({ ok: true, requestId, window, items: [], nextCursor: null }, { headers });
      }
      requestIdsFilter = requestIds;
    }

    let query = admin
      .from("ops_case_workflow")
      .select("request_id,status,priority,assigned_to_user_id,last_touched_at,created_at,updated_at,sla_due_at")
      .gte("last_touched_at", fromIso)
      .limit(limit + 1);

    if (statusParam === "waiting") {
      query = query.in("status", ["waiting_on_user", "waiting_on_provider"]);
    } else if (statusParam !== "all") {
      query = query.eq("status", statusParam);
    }
    if (priorityParam === "p0_p1") {
      query = query.in("priority", ["p0", "p1"]);
    } else if (priorityParam !== "all") {
      query = query.eq("priority", priorityParam);
    }
    if (assignedParam === "me") query = query.eq("assigned_to_user_id", user.id);
    if (assignedParam === "unassigned") query = query.is("assigned_to_user_id", null);
    if (breachedOnly) query = query.lt("sla_due_at", nowIso);

    if (requestIdsFilter?.length) {
      query = query.in("request_id", requestIdsFilter);
    } else if (search.kind === "requestId" && search.value) {
      if (search.value.includes(",")) {
        const values = search.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (values.length) query = query.in("request_id", values);
      } else {
        query = query.ilike("request_id", `%${search.value}%`);
      }
    }

    if (sort === "createdAt") {
      query = query.order("created_at", { ascending: false }).order("request_id", { ascending: false });
    } else if (sort === "priority") {
      query = query.order("priority", { ascending: true }).order("last_touched_at", { ascending: false });
    } else if (sort === "status") {
      query = query.order("status", { ascending: true }).order("last_touched_at", { ascending: false });
    } else if (sort === "sla") {
      query = query.order("sla_due_at", { ascending: true }).order("request_id", { ascending: false });
    } else {
      query = query.order("last_touched_at", { ascending: false }).order("request_id", { ascending: false });
    }

    if (cursor && (sort === "lastTouched" || sort === "createdAt")) {
      const column = sort === "createdAt" ? "created_at" : "last_touched_at";
      query = query.or(`${column}.lt.${cursor.ts},and(${column}.eq.${cursor.ts},request_id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const hasNext = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const requestIds = pageRows.map((row) => row.request_id);

    if (!requestIds.length) {
      return NextResponse.json({ ok: true, requestId, window, items: [], nextCursor: null }, { headers });
    }

    const [notesRows, evidenceRows, contextRows] = await Promise.all([
      admin
        .from("ops_case_notes")
        .select("case_key,updated_at")
        .eq("case_type", "request")
        .in("case_key", requestIds),
      admin
        .from("ops_case_evidence")
        .select("request_id,created_at")
        .in("request_id", requestIds),
      admin
        .from("ops_request_context")
        .select("request_id,user_id,source,confidence")
        .in("request_id", requestIds),
    ]);

    if (notesRows.error) throw notesRows.error;
    if (evidenceRows.error) throw evidenceRows.error;
    if (contextRows.error) throw contextRows.error;

    const notesMap = new Map<string, { updatedAt: string }>();
    (notesRows.data ?? []).forEach((row) => {
      notesMap.set(row.case_key, { updatedAt: row.updated_at });
    });

    const evidenceStats = new Map<string, { count: number; lastAt: string | null }>();
    (evidenceRows.data ?? []).forEach((row) => {
      const current = evidenceStats.get(row.request_id) ?? { count: 0, lastAt: null };
      const nextCount = current.count + 1;
      const nextLast = current.lastAt && current.lastAt > row.created_at ? current.lastAt : row.created_at;
      evidenceStats.set(row.request_id, { count: nextCount, lastAt: nextLast });
    });

    const contextMap = new Map<string, { userId: string | null; source: string | null; confidence: string | null }>();
    (contextRows.data ?? []).forEach((row) => {
      contextMap.set(row.request_id, {
        userId: row.user_id ?? null,
        source: row.source ?? null,
        confidence: row.confidence ?? null,
      });
    });

    const items = pageRows.map((row) => {
      const noteInfo = notesMap.get(row.request_id);
      const evidenceInfo = evidenceStats.get(row.request_id);
      const contextInfo = contextMap.get(row.request_id);
      const priorityValue = normaliseCasePriority(row.priority) ?? "p2";
      const slaInfo = computeCaseSla({ priority: priorityValue, createdAt: row.created_at, now });
      return {
        requestId: row.request_id,
        status: row.status,
        priority: priorityValue,
        assignedUserId: row.assigned_to_user_id ?? null,
        assignedToMe: row.assigned_to_user_id === user.id,
        lastTouchedAt: resolveCaseLastTouched({
          workflowTouched: row.last_touched_at,
          workflowUpdated: row.updated_at,
          notesUpdated: noteInfo?.updatedAt ?? null,
          evidenceUpdated: evidenceInfo?.lastAt ?? null,
        }),
        createdAt: row.created_at,
        slaDueAt: slaInfo?.dueAt ?? row.sla_due_at ?? null,
        slaBreached: slaInfo?.breached ?? false,
        slaRemainingMs: slaInfo?.remainingMs ?? null,
        notesCount: noteInfo ? 1 : 0,
        evidenceCount: evidenceInfo?.count ?? 0,
        userContext: contextInfo
          ? {
              userId: contextInfo.userId,
              source: contextInfo.source,
              confidence: contextInfo.confidence,
            }
          : null,
      };
    });

    let nextCursor: string | null = null;
    if (hasNext && (sort === "lastTouched" || sort === "createdAt")) {
      const lastRow = pageRows[pageRows.length - 1];
      const cursorValue = sort === "createdAt" ? lastRow.created_at : lastRow.last_touched_at;
      nextCursor = encodeCaseQueueCursor({ ts: cursorValue, id: lastRow.request_id });
    }

    return NextResponse.json({ ok: true, requestId, window, items, nextCursor }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/cases", code: "OPS_CASES_LIST_FAIL" });
    return jsonError({ code: "OPS_CASES_LIST_FAIL", message: "Unable to load cases", requestId });
  }
}
