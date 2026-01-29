import { NextResponse } from "next/server";
import crypto from "crypto";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  meta: Record<string, any>;
};

type ActorInfo = { email?: string | null; role?: string | null };

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function maskEmail(value: string) {
  const [user, domain] = value.split("@");
  if (!domain) return value;
  if (user.length <= 2) return "***@" + domain;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function maskIp(value: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split(".");
    parts[parts.length - 1] = "xx";
    return parts.join(".");
  }
  return value;
}

function maskValue(value: any): any {
  if (typeof value === "string") {
    if (value.includes("@")) return maskEmail(value);
    if (value.toLowerCase().includes("bearer")) return "[masked_token]";
    if (value.toLowerCase().includes("cookie")) return "[masked_cookie]";
    if (value.match(/\d+\.\d+\.\d+\.\d+/)) return maskIp(value);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskValue(v));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = maskValue((value as any)[key]);
      return acc;
    }, {} as Record<string, any>);
  }
  return value;
}

function parseCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [ts, id] = decoded.split("|");
    if (!ts || !id || Number.isNaN(Date.parse(ts)) || !isUuid(id)) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  try {
    const { user } = await getSupabaseUser();
    if (!user) {
      return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
    }
    const roleInfo = await getUserRole(user.id);
    if (!isOpsRole(roleInfo.role)) {
      return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const actorId = url.searchParams.get("actorId");
    const actionsRaw = url.searchParams.get("action");
    const since = url.searchParams.get("since");
    const until = url.searchParams.get("until");
    const qRaw = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const cursorParam = url.searchParams.get("cursor");

    if (userId && !isUuid(userId)) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid userId", requestId, status: 400 });
    }
    if (actorId && !isUuid(actorId)) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid actorId", requestId, status: 400 });
    }
    if (since && Number.isNaN(Date.parse(since))) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid since", requestId, status: 400 });
    }
    if (until && Number.isNaN(Date.parse(until))) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid until", requestId, status: 400 });
    }

    const parsedCursor = parseCursor(cursorParam);
    if (cursorParam && !parsedCursor) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid cursor", requestId, status: 400 });
    }

    let limit = Number(limitParam ?? 50);
    if (Number.isNaN(limit) || limit <= 0) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid limit", requestId, status: 400 });
    }
    limit = Math.min(limit, 200);

    const actionList =
      actionsRaw
        ?.split(",")
        .map((a) => a.trim())
        .filter(Boolean) ?? [];
    const q = (qRaw ?? "").trim().slice(0, 64).replace(/[%]/g, "");

    const admin = createServiceRoleClient();
    let query = admin
      .from("ops_audit_log")
      .select("id,created_at,actor_user_id,target_user_id,action,meta")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (userId) query = query.eq("target_user_id", userId);
    if (actorId) query = query.eq("actor_user_id", actorId);
    if (actionList.length > 0) query = query.in("action", actionList);
    if (since) query = query.gte("created_at", since);
    if (until) query = query.lte("created_at", until);
    if (parsedCursor) {
      const { ts, id } = parsedCursor;
      query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`);
    }
    if (q) {
      const like = `%${q}%`;
      query = query.or(`action.ilike.${like},meta->>requestId.ilike.${like},meta->>ref.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows: AuditRow[] = data ?? [];
    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const last = trimmed[trimmed.length - 1];

    const actorIds = Array.from(
      new Set(trimmed.map((r) => r.actor_user_id).filter((v): v is string => Boolean(v)))
    );
    const actorInfoMap = new Map<string, ActorInfo>();
    if (actorIds.length > 0) {
      const { data: rolesData } = await admin
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", actorIds);
      const roleMap = new Map<string, string | null>();
      (rolesData ?? []).forEach((r) => roleMap.set(r.user_id, r.role));

      await Promise.all(
        actorIds.map(async (id) => {
          try {
            const res = await admin.auth.admin.getUserById(id);
            actorInfoMap.set(id, { email: res.data?.user?.email ?? null, role: roleMap.get(id) ?? null });
          } catch {
            actorInfoMap.set(id, { email: null, role: roleMap.get(id) ?? null });
          }
        })
      );
    }

    const items = trimmed.map((row) => {
      const meta = maskValue(row.meta ?? {});
      const ref = meta?.ref ?? meta?.note ?? meta?.reference ?? undefined;
      const requestIdMeta = meta?.requestId ?? meta?.req ?? undefined;
      return {
        id: row.id,
        at: row.created_at,
        action: row.action,
        actor: row.actor_user_id ? { id: row.actor_user_id, ...actorInfoMap.get(row.actor_user_id) } : null,
        target: row.target_user_id ? { userId: row.target_user_id } : null,
        ref: typeof ref === "string" ? ref : undefined,
        requestId: typeof requestIdMeta === "string" ? requestIdMeta : undefined,
        meta,
      };
    });

    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.created_at}|${last.id}`).toString("base64")
        : undefined;

    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: null,
      action: "ops_audits_view",
      meta: {
        requestId,
        resultCount: items.length,
        queryType: q ? "search_hashed" : "filter",
        hashedQuery: q ? crypto.createHash("sha256").update(q.toLowerCase()).digest("hex") : null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        items,
        page: { hasMore, nextCursor },
        masked: true,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/audits", code: "AUDITS_LIST_FAIL" });
    return jsonError({ code: "AUDITS_LIST_FAIL", message: "Unable to list audits", requestId });
  }
}
