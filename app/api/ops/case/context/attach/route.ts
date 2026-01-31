import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logMonetisationEvent } from "@/lib/monetisation";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { upsertRequestContext } from "@/lib/ops/ops-request-context";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { upsertCaseQueueSource } from "@/lib/ops/ops-case-queue-store";
import { insertCaseAudit } from "@/lib/ops/ops-case-audit";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return { id: match.id, email: match.email ?? null };
    }
    lastPage = Number(data?.lastPage ?? page);
    if (!lastPage || Number.isNaN(lastPage)) lastPage = page;
    page += 1;
  }
  return null;
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isAdminRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Admin role required", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_context_attach");
  const limiter = checkRateLimit({
    route: "ops_case_context_attach",
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
      meta: { limitKey: "ops_case_context_attach", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const requestIdInput = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  const userIdInput = typeof body?.userId === "string" ? body.userId.trim() : "";
  const emailInput = typeof body?.email === "string" ? body.email.trim() : "";
  const noteInput = typeof body?.note === "string" ? body.note.trim() : "";

  if (!requestIdInput) return jsonError({ code: "BAD_REQUEST", message: "requestId required", requestId, status: 400 });
  if (!userIdInput && !emailInput) {
    return jsonError({ code: "BAD_REQUEST", message: "userId or email required", requestId, status: 400 });
  }

  let resolvedUserId: string | null = userIdInput || null;
  let resolvedEmail: string | null = emailInput || null;

  try {
    if (emailInput) {
      const match = await findUserByEmail(emailInput);
      if (!match) {
        return jsonError({ code: "USER_NOT_FOUND", message: "User not found for email", requestId, status: 404 });
      }
      resolvedUserId = match.id;
      resolvedEmail = match.email ?? emailInput;
    }

    const sanitizedNote = sanitizeMonetisationMeta({ note: noteInput }).note ?? noteInput;
    const context = await upsertRequestContext({
      requestId: requestIdInput,
      userId: resolvedUserId ?? null,
      email: resolvedEmail ?? null,
      source: "manual_admin_attach",
      confidence: "high",
      path: "/api/ops/case/context/attach",
      meta: { note: sanitizedNote ?? null, actorUserId: user.id },
      evidence: { note: sanitizedNote ?? null, actorUserId: user.id },
    });

    try {
      await upsertCaseQueueSource({
        requestId: requestIdInput,
        code: "MANUAL",
        primarySource: "manual_attach",
        detail: "Manual user context attached",
      });
    } catch {
      // best-effort only
    }

    try {
      await insertOpsAuditLog(createServiceRoleClient() as any, {
        actorUserId: user.id,
        targetUserId: resolvedUserId ?? null,
        action: "ops_case_context_attach",
        meta: sanitizeMonetisationMeta({
          requestId: requestIdInput,
          note: sanitizedNote ?? null,
          hasEmail: Boolean(resolvedEmail),
        }),
      });
    } catch {
      // ignore audit failures
    }

    await insertCaseAudit({
      requestId: requestIdInput,
      actorUserId: user.id,
      action: "ATTACH_USER",
      meta: { hasEmail: Boolean(resolvedEmail), hasUserId: Boolean(resolvedUserId) },
    });

    try {
      const admin = createServiceRoleClient();
      await logMonetisationEvent(admin as any, user.id, "ops_case_context_attach", {
        meta: { hasUserId: Boolean(resolvedUserId), hasEmail: Boolean(resolvedEmail) },
      });
    } catch {
      // ignore
    }

    let userRole: string | null = null;
    if (context?.user_id) {
      const { data: roleRow } = await createServiceRoleClient()
        .from("user_roles")
        .select("role")
        .eq("user_id", context.user_id)
        .maybeSingle();
      userRole = roleRow?.role ?? null;
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        context: context
          ? {
              requestId: context.request_id,
              userId: context.user_id ?? null,
              emailMasked: context.email_masked ?? null,
              userRole,
              source: context.source ?? null,
              confidence: context.confidence ?? null,
              evidenceAt: context.updated_at ?? context.last_seen_at,
              sources: context.sources ?? [],
              firstSeenAt: context.first_seen_at,
              lastSeenAt: context.last_seen_at,
              lastSeenPath: context.last_seen_path ?? null,
            }
          : null,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/context/attach", code: "OPS_CASE_CONTEXT_ATTACH_FAIL" });
    return jsonError({ code: "OPS_CASE_CONTEXT_ATTACH_FAIL", message: "Unable to attach context", requestId });
  }
}
