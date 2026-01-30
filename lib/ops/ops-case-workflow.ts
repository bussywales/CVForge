import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type CaseWorkflowStatus = "open" | "investigating" | "monitoring" | "resolved" | "closed";
export type CasePriority = "low" | "medium" | "high";

export type OpsCaseWorkflowRow = {
  request_id: string;
  status: CaseWorkflowStatus;
  priority: CasePriority;
  assigned_to_user_id: string | null;
  claimed_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_touched_at: string;
  created_at: string;
  updated_at: string;
};

export const CASE_WORKFLOW_STATUSES: CaseWorkflowStatus[] = [
  "open",
  "investigating",
  "monitoring",
  "resolved",
  "closed",
];

export const CASE_PRIORITY_LEVELS: CasePriority[] = ["low", "medium", "high"];

export function normaliseCaseStatus(value?: unknown): CaseWorkflowStatus | null {
  if (typeof value !== "string") return null;
  return CASE_WORKFLOW_STATUSES.includes(value as CaseWorkflowStatus) ? (value as CaseWorkflowStatus) : null;
}

export function normaliseCasePriority(value?: unknown): CasePriority | null {
  if (typeof value !== "string") return null;
  return CASE_PRIORITY_LEVELS.includes(value as CasePriority) ? (value as CasePriority) : null;
}

function coerceWorkflowRow(row: any, nowIso: string): OpsCaseWorkflowRow {
  return {
    request_id: row.request_id,
    status: normaliseCaseStatus(row.status) ?? "open",
    priority: normaliseCasePriority(row.priority) ?? "medium",
    assigned_to_user_id: row.assigned_to_user_id ?? null,
    claimed_at: row.claimed_at ?? null,
    resolved_at: row.resolved_at ?? null,
    closed_at: row.closed_at ?? null,
    last_touched_at: row.last_touched_at ?? nowIso,
    created_at: row.created_at ?? nowIso,
    updated_at: row.updated_at ?? nowIso,
  };
}

export async function getCaseWorkflow(requestId: string): Promise<OpsCaseWorkflowRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return coerceWorkflowRow(data, new Date().toISOString());
}

export async function getOrCreateCaseWorkflow({
  requestId,
  now = new Date(),
}: {
  requestId: string;
  now?: Date;
}): Promise<OpsCaseWorkflowRow> {
  const existing = await getCaseWorkflow(requestId);
  if (existing) return existing;
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const payload = {
    request_id: requestId,
    status: "open",
    priority: "medium",
    assigned_to_user_id: null,
    claimed_at: null,
    resolved_at: null,
    closed_at: null,
    last_touched_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const { data, error } = await admin
    .from("ops_case_workflow")
    .insert(payload)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return coerceWorkflowRow(data, nowIso);
}

export async function touchCaseWorkflow({ requestId, now = new Date() }: { requestId: string; now?: Date }) {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update({ last_touched_at: nowIso })
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .maybeSingle();
  if (error) throw error;
  return data ? coerceWorkflowRow(data, nowIso) : null;
}

export async function claimCaseWorkflow({
  requestId,
  actorUserId,
  now = new Date(),
}: {
  requestId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ row: OpsCaseWorkflowRow; conflict: boolean }> {
  const existing = await getOrCreateCaseWorkflow({ requestId, now });
  if (existing.assigned_to_user_id && existing.assigned_to_user_id !== actorUserId) {
    return { row: existing, conflict: true };
  }
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update({
      assigned_to_user_id: actorUserId,
      claimed_at: existing.claimed_at ?? nowIso,
      last_touched_at: nowIso,
      updated_at: nowIso,
    })
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return { row: coerceWorkflowRow(data, nowIso), conflict: false };
}

export async function releaseCaseWorkflow({
  requestId,
  now = new Date(),
}: {
  requestId: string;
  now?: Date;
}): Promise<OpsCaseWorkflowRow | null> {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update({
      assigned_to_user_id: null,
      claimed_at: null,
      last_touched_at: nowIso,
      updated_at: nowIso,
    })
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return coerceWorkflowRow(data, nowIso);
}

export async function assignCaseWorkflow({
  requestId,
  assignedToUserId,
  now = new Date(),
}: {
  requestId: string;
  assignedToUserId: string | null;
  now?: Date;
}): Promise<OpsCaseWorkflowRow> {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update({
      assigned_to_user_id: assignedToUserId,
      claimed_at: assignedToUserId ? nowIso : null,
      last_touched_at: nowIso,
      updated_at: nowIso,
    })
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return coerceWorkflowRow(data, nowIso);
}

export async function updateCaseStatus({
  requestId,
  status,
  priority,
  now = new Date(),
}: {
  requestId: string;
  status: CaseWorkflowStatus;
  priority?: CasePriority | null;
  now?: Date;
}): Promise<OpsCaseWorkflowRow> {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const payload: Record<string, any> = {
    status,
    last_touched_at: nowIso,
    updated_at: nowIso,
  };
  if (priority) payload.priority = priority;
  if (status === "resolved") {
    payload.resolved_at = nowIso;
  }
  if (status === "closed") {
    payload.closed_at = nowIso;
  }
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update(payload)
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return coerceWorkflowRow(data, nowIso);
}

export async function updateCasePriority({
  requestId,
  priority,
  now = new Date(),
}: {
  requestId: string;
  priority: CasePriority;
  now?: Date;
}): Promise<OpsCaseWorkflowRow> {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("ops_case_workflow")
    .update({ priority, last_touched_at: nowIso, updated_at: nowIso })
    .eq("request_id", requestId)
    .select(
      "request_id,status,priority,assigned_to_user_id,claimed_at,resolved_at,closed_at,last_touched_at,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return coerceWorkflowRow(data, nowIso);
}

export function sanitizeCaseWorkflowMeta(meta?: Record<string, any>) {
  return sanitizeMonetisationMeta(meta ?? {});
}
