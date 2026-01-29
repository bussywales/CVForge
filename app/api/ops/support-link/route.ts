import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  BILLING_PACKS,
  BILLING_PLANS,
  SUPPORT_FOCUS_TARGETS,
  buildSupportLink,
  type SupportLinkKind,
} from "@/lib/ops/support-links";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // derive requestId from inbound headers but build fresh response headers to avoid carrying request content headers
  const { requestId } = withRequestIdHeaders(request.headers);
  const responseHeaders = new Headers({ "x-request-id": requestId });
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
  const planRaw = typeof body?.plan === "string" ? body.plan : null;
  const packRaw = typeof body?.pack === "string" ? body.pack : null;
  const appId = typeof body?.appId === "string"
    ? body.appId
    : typeof body?.applicationId === "string"
    ? body.applicationId
    : null;
  const anchor = typeof body?.anchor === "string" ? body.anchor : null;
  const flow =
    typeof body?.flow === "string"
      ? body.flow
          .toString()
          .trim()
          .slice(0, 32)
          .replace(/[^a-zA-Z0-9_-]/g, "") || null
      : null;
  const focusRaw = typeof body?.focus === "string" ? body.focus : null;
  const portal = body?.portal ? "1" : null;

  const allowedKinds: SupportLinkKind[] = [
    "billing",
    "billing_compare",
    "billing_subscription",
    "billing_subscription_30",
    "billing_subscription_80",
    "billing_topup",
    "billing_topup_starter",
    "billing_topup_pro",
    "billing_topup_power",
    "application",
    "application_outreach",
    "application_offer",
    "application_outcome",
    "application_interview",
    "interview",
  ];

  if (!targetUserId || !kind || !allowedKinds.includes(kind)) {
    return jsonError({ code: "INVALID_PAYLOAD", message: "Invalid payload", requestId, status: 400 });
  }

  const plan = BILLING_PLANS.includes(planRaw as any) ? (planRaw as (typeof BILLING_PLANS)[number]) : null;
  const pack = BILLING_PACKS.includes(packRaw as any) ? (packRaw as (typeof BILLING_PACKS)[number]) : null;
  const focus = SUPPORT_FOCUS_TARGETS.includes(focusRaw as any) ? (focusRaw as (typeof SUPPORT_FOCUS_TARGETS)[number]) : null;

  if (kind.startsWith("application") && !appId) {
    return jsonError({ code: "INVALID_PAYLOAD", message: "Application required", requestId, status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    // Validate application ownership when provided
    if (appId) {
      const { data, error } = await admin.from("applications").select("user_id").eq("id", appId).single();
      if (error || !data || data.user_id !== targetUserId) {
        return jsonError({ code: "INVALID_APP", message: "Application not found for user", requestId, status: 400 });
      }
    }
    const url = buildSupportLink({
      kind,
      userId: targetUserId,
      appId,
      anchor,
      flow,
      focus,
      pack,
      plan,
      portal,
    });

    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: targetUserId,
      action: "support_link_generated",
      meta: { kind, plan, pack, appId, anchor, focus, flow, portal, requestId },
    });

    return NextResponse.json({ ok: true, url: String(url) }, { headers: responseHeaders, status: 200 });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/support-link", userId: user.id, code: "SUPPORT_LINK_FAIL" });
    return jsonError({ code: "SUPPORT_LINK_FAIL", message: "Unable to generate link", requestId });
  }
}
