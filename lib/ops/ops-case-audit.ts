import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type CaseAuditAction =
  | "CLAIM"
  | "RELEASE"
  | "SET_STATUS"
  | "SET_PRIORITY"
  | "ATTACH_USER"
  | "ADD_NOTE"
  | "ADD_EVIDENCE"
  | "SET_REASON_MANUAL"
  | "RESOLVE"
  | "REOPEN";

export type CaseAuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  request_id: string;
  action: CaseAuditAction;
  meta: Record<string, any>;
};

export function sanitizeCaseAuditMeta(meta?: Record<string, any>) {
  return sanitizeMonetisationMeta(meta ?? {});
}

export async function insertCaseAudit({
  requestId,
  actorUserId,
  action,
  meta,
  now = new Date(),
}: {
  requestId: string;
  actorUserId: string | null;
  action: CaseAuditAction;
  meta?: Record<string, any>;
  now?: Date;
}) {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const payload = {
    request_id: requestId,
    actor_user_id: actorUserId,
    action,
    meta: sanitizeCaseAuditMeta(meta),
    created_at: now.toISOString(),
  };
  try {
    const { data, error } = await admin
      .from("ops_case_audit")
      .insert(payload)
      .select("id,created_at,actor_user_id,request_id,action,meta")
      .single();
    if (error) throw error;
    return data as CaseAuditRow;
  } catch {
    return null;
  }
}

export async function listCaseAudit({
  requestId,
  limit = 50,
}: {
  requestId: string;
  limit?: number;
}) {
  if (!requestId) return [];
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_case_audit")
    .select("id,created_at,actor_user_id,request_id,action,meta")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw error;
  return (data ?? []) as CaseAuditRow[];
}

