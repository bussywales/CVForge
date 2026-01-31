import "server-only";

import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { upsertCaseQueueSource } from "@/lib/ops/ops-case-queue-store";
import { isLikelyRequestId, upsertRequestContext } from "@/lib/ops/ops-request-context";

type OpsAuditInsert = {
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  meta?: Record<string, any>;
  createdAt?: string;
};

export async function insertOpsAuditLog(admin: any, input: OpsAuditInsert) {
  const meta = input.meta ?? {};
  const payload: Record<string, any> = {
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId,
    action: input.action,
    meta,
  };
  if (input.createdAt) {
    payload.created_at = input.createdAt;
  }

  const { error } = await admin.from("ops_audit_log").insert(payload);
  if (error) {
    throw error;
  }

  const requestId =
    typeof meta.requestId === "string"
      ? meta.requestId
      : typeof meta.req === "string"
        ? meta.req
        : null;
  const userId = input.targetUserId ?? input.actorUserId ?? null;
  if (!requestId || !userId || !isLikelyRequestId(requestId)) return;

  try {
    await upsertRequestContext({
      requestId,
      userId,
      source: "ops_audit",
      confidence: "high",
      path: typeof meta.path === "string" ? meta.path : null,
      meta: sanitizeMonetisationMeta({ action: input.action }),
      evidence: sanitizeMonetisationMeta({ action: input.action }),
    });
  } catch {
    // best-effort only
  }

  try {
    await upsertCaseQueueSource({
      requestId,
      code: "MANUAL",
      primarySource: "ops_audit",
      detail: `Audit activity: ${input.action}`,
    });
  } catch {
    // best-effort only
  }
}
