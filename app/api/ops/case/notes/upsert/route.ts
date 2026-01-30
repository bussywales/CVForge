import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isAdminRole, isOpsRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logMonetisationEvent } from "@/lib/monetisation";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  CaseNotesPatch,
  applyCaseNotesPatch,
  getCaseNotes,
  normaliseCaseType,
  parseOutcomeCode,
  sanitizeCaseNotesMeta,
  upsertCaseNotes,
} from "@/lib/ops/ops-case-notes";
import { captureServerError } from "@/lib/observability/sentry";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashCaseKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 10);
}

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  const roleInfo = await getUserRole(user.id);
  if (!isOpsRole(roleInfo.role)) return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });

  const budget = getRateLimitBudget("ops_case_notes_upsert");
  const limiter = checkRateLimit({
    route: "ops_case_notes_upsert",
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
      meta: { limitKey: "ops_case_notes_upsert", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return jsonError({ code: "NON_JSON", message: "Invalid payload", requestId, status: 400 });
  }

  const caseType = normaliseCaseType(body?.caseType);
  const caseKey = normaliseId(body?.caseKey);
  const patch = (body?.patch ?? {}) as CaseNotesPatch;
  const windowLabel = typeof body?.windowLabel === "string" ? body.windowLabel : null;

  if (!caseType || !caseKey) {
    return jsonError({ code: "BAD_REQUEST", message: "caseType and caseKey required", requestId, status: 400 });
  }

  const statusInput = patch.status ?? null;
  if (statusInput && statusInput !== "open" && statusInput !== "closed") {
    return jsonError({ code: "INVALID_STATUS", message: "Invalid status", requestId, status: 400 });
  }
  if (statusInput === "closed" && !isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Admin role required to close case", requestId, status: 403 });
  }

  if (patch.outcome_code !== undefined) {
    const parsed = parseOutcomeCode(patch.outcome_code);
    if (patch.outcome_code && !parsed) {
      return jsonError({ code: "INVALID_OUTCOME", message: "Invalid outcome code", requestId, status: 400 });
    }
    if (parsed) patch.outcome_code = parsed;
  }

  if (patch.checklist && typeof patch.checklist !== "object") {
    return jsonError({ code: "INVALID_CHECKLIST", message: "Invalid checklist patch", requestId, status: 400 });
  }

  try {
    const existing = await getCaseNotes({ caseType, caseKey });
    const preview = applyCaseNotesPatch({
      existing,
      patch,
      actorId: user.id,
      now: new Date(),
    });
    if (!preview.changed) {
      return NextResponse.json(
        {
          ok: true,
          requestId,
          notes: existing
            ? {
                caseType: existing.case_type,
                caseKey: existing.case_key,
                windowLabel: existing.window_label ?? null,
                checklist: existing.checklist ?? {},
                outcomeCode: existing.outcome_code ?? null,
                notes: existing.notes ?? null,
                status: existing.status ?? "open",
                lastHandledAt: existing.last_handled_at ?? null,
                lastHandledBy: existing.last_handled_by ?? null,
                createdAt: existing.created_at,
                updatedAt: existing.updated_at,
              }
            : null,
        },
        { headers }
      );
    }

    const { row, toggledKeys } = await upsertCaseNotes({
      caseType,
      caseKey,
      patch,
      actorId: user.id,
      windowLabel,
    });

    const caseKeyHash = hashCaseKey(caseKey);
    const safeMeta = sanitizeCaseNotesMeta({
      caseType,
      caseKeyHash,
      status: row?.status ?? null,
      outcomeCode: row?.outcome_code ?? null,
      noteLength: row?.notes ? row.notes.length : 0,
      toggledKeys,
      windowLabel,
      requestId: caseType === "request" ? caseKey : null,
    });

    const admin = createServiceRoleClient();
    const action = statusInput === "closed" ? "ops_case_close" : "ops_case_update";
    await insertOpsAuditLog(admin, {
      actorUserId: user.id,
      targetUserId: row?.last_handled_by ?? null,
      action,
      meta: safeMeta,
    });

    try {
      await logMonetisationEvent(admin as any, user.id, "ops_case_notes_save", {
        meta: {
          caseType,
          outcomeCode: row?.outcome_code ?? null,
          noteLength: row?.notes ? row.notes.length : 0,
          toggledCount: toggledKeys.length,
          status: row?.status ?? null,
        },
      });
      if (toggledKeys.length) {
        await logMonetisationEvent(admin as any, user.id, "ops_case_checklist_toggle", {
          meta: { caseType, toggledCount: toggledKeys.length },
        });
      }
      if (statusInput === "closed") {
        await logMonetisationEvent(admin as any, user.id, "ops_case_close", {
          meta: { caseType, status: "closed" },
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        notes: row
          ? {
              caseType: row.case_type,
              caseKey: row.case_key,
              windowLabel: row.window_label ?? null,
              checklist: row.checklist ?? {},
              outcomeCode: row.outcome_code ?? null,
              notes: row.notes ?? null,
              status: row.status ?? "open",
              lastHandledAt: row.last_handled_at ?? null,
              lastHandledBy: row.last_handled_by ?? null,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }
          : null,
        toggledKeys,
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/case/notes/upsert", code: "OPS_CASE_NOTES_UPSERT_FAIL" });
    return jsonError({ code: "OPS_CASE_NOTES_UPSERT_FAIL", message: "Unable to save case notes", requestId });
  }
}
