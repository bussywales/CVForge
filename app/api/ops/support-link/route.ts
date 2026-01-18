import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildSupportLink, type SupportLinkKind } from "@/lib/ops/support-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;
  const kind = body?.kind as SupportLinkKind | undefined;
  const plan = typeof body?.plan === "string" ? body.plan : undefined;
  const pack = typeof body?.pack === "string" ? body.pack : undefined;
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : undefined;
  const tab = typeof body?.tab === "string" ? body.tab : undefined;
  const anchor = typeof body?.anchor === "string" ? body.anchor : undefined;

  if (!targetUserId || !kind) {
    return jsonError({ code: "INVALID_PAYLOAD", message: "Invalid payload", requestId, status: 400 });
  }

  try {
    let resolvedKind: SupportLinkKind = kind;
    if (kind === "billing_subscription_30" || kind === "billing_subscription_80") {
      resolvedKind = kind;
    }
    if (kind === "billing_topup_starter" || kind === "billing_topup_pro" || kind === "billing_topup_power") {
      resolvedKind = kind;
    }
    const url = buildSupportLink({
      kind: resolvedKind,
      userId: targetUserId,
      applicationId,
      tab,
      anchor,
    });

    const admin = createServiceRoleClient();
    await admin.from("ops_audit_log").insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      action: "support_link_generated",
      meta: { kind: resolvedKind, plan, pack, applicationId, tab, anchor, requestId },
    });

    return NextResponse.json({ ok: true, url: String(url) }, { headers, status: 200 });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/support-link", userId: user.id, code: "SUPPORT_LINK_FAIL" });
    return jsonError({ code: "SUPPORT_LINK_FAIL", message: "Unable to generate link", requestId });
  }
}
