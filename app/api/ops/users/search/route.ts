import { NextResponse } from "next/server";
import crypto from "crypto";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { upsertRequestContext } from "@/lib/ops/ops-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserResult = {
  id: string;
  email: string | null;
  createdAt: string | null;
  name?: string | null;
  role?: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

async function findUserById(userId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    createdAt: data.user.created_at ?? null,
  } as UserResult;
}

async function findUserByEmail(email: string) {
  const admin = createServiceRoleClient();
  const perPage = 200;
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const match = (data?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match) {
      return {
        id: match.id,
        email: match.email ?? null,
        createdAt: match.created_at ?? null,
      } as UserResult;
    }
    lastPage = Number(data?.lastPage ?? page);
    if (!lastPage || Number.isNaN(lastPage)) {
      lastPage = page;
    }
    page += 1;
  }
  return null;
}

export async function GET(request: Request) {
  const { requestId, headers } = withRequestIdHeaders(request.headers);
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
    const rawQuery = url.searchParams.get("q") ?? "";
    const q = rawQuery.trim();
    if (!q || q.length < 3) {
      return jsonError({ code: "BAD_INPUT", message: "Query too short", requestId, status: 400 });
    }

    const queryType = isUuid(q) ? "userId" : "email";
    const users: UserResult[] = [];
    const found =
      queryType === "userId" ? await findUserById(q) : await findUserByEmail(q);
    if (found) {
      users.push(found);
    }

    const admin = createServiceRoleClient();
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const profileMap = new Map<string, string | null>();
      (profiles ?? []).forEach((p) => profileMap.set(p.user_id, p.full_name));

      const { data: roles } = await admin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const roleMap = new Map<string, string | null>();
      (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role));

      users.forEach((u) => {
        u.name = profileMap.get(u.id) ?? null;
        u.role = roleMap.get(u.id) ?? null;
      });
    }

    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: null,
      action: "ops_user_search",
      meta: {
        queryType,
        hashedQuery: crypto.createHash("sha256").update(q.toLowerCase()).digest("hex"),
        resultCount: users.length,
        requestId,
      },
    });

    const requestIdParam = url.searchParams.get("requestId")?.trim() ?? "";
    if (requestIdParam && users.length > 0) {
      try {
        const target = users[0];
        await upsertRequestContext({
          requestId: requestIdParam,
          userId: target.id,
          email: target.email ?? null,
          source: "users_search",
          path: "/api/ops/users/search",
          meta: { queryType, resultCount: users.length },
        });
      } catch {
        // best-effort only
      }
    }

    return NextResponse.json({ ok: true, users }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/users/search", code: "USER_SEARCH_FAIL" });
    return jsonError({ code: "USER_SEARCH_FAIL", message: "Unable to search users", requestId });
  }
}
