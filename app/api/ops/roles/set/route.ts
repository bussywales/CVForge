import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole, canAssignRole, type UserRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  const role = body?.role as UserRole | null;
  if (!targetUserId || !role || !["user", "support", "admin", "super_admin"].includes(role)) {
    return jsonError({ code: "INVALID_PAYLOAD", message: "Invalid payload", requestId, status: 400 });
  }

  try {
    const actorRoleInfo = await getUserRole(user.id);
    if (!isOpsRole(actorRoleInfo.role)) {
      return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
    }
    if (!canAssignRole(actorRoleInfo.role, role)) {
      return jsonError({ code: "FORBIDDEN_ROLE", message: "Cannot grant requested role", requestId, status: 403 });
    }

    const admin = createServiceRoleClient();
    const previousRoleInfo = await getUserRole(targetUserId);
    await admin
      .from("user_roles")
      .upsert({ user_id: targetUserId, role, updated_at: new Date().toISOString() })
      .select("role")
      .single();

    await admin.from("ops_audit_log").insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      action: "role_set",
      meta: {
        previousRole: previousRoleInfo.role,
        newRole: role,
        source: "ops_ui",
      },
    });

    return NextResponse.json({ ok: true, role }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/roles/set", userId: user.id, code: "ROLE_SET_FAILED" });
    return jsonError({ code: "ROLE_SET_FAILED", message: "Unable to update role", requestId });
  }
}
