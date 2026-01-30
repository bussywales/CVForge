import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type CaseEvidenceType = "note" | "link" | "screenshot_ref" | "decision";

export type OpsCaseEvidenceRow = {
  id: string;
  request_id: string;
  type: CaseEvidenceType;
  body: string;
  meta: Record<string, any> | null;
  created_by_user_id: string;
  created_at: string;
};

const EVIDENCE_TYPES: CaseEvidenceType[] = ["note", "link", "screenshot_ref", "decision"];
const MAX_BODY_LEN = 800;

export function normaliseEvidenceType(value?: unknown): CaseEvidenceType | null {
  if (typeof value !== "string") return null;
  return EVIDENCE_TYPES.includes(value as CaseEvidenceType) ? (value as CaseEvidenceType) : null;
}

export function sanitizeEvidenceBody(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, MAX_BODY_LEN);
  if (!trimmed) return null;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  return trimmed.replace(emailPattern, "[email-redacted]");
}

export function sanitizeEvidenceMeta(meta?: Record<string, any>) {
  const safe = sanitizeMonetisationMeta(meta ?? {});
  if (typeof meta?.scenarioId === "string") {
    safe.scenarioId = meta.scenarioId.slice(0, 8);
  }
  return safe;
}

function coerceEvidenceRow(row: any): OpsCaseEvidenceRow {
  return {
    id: row.id,
    request_id: row.request_id,
    type: normaliseEvidenceType(row.type) ?? "note",
    body: row.body ?? "",
    meta: row.meta && typeof row.meta === "object" ? row.meta : null,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
  };
}

export async function listCaseEvidence({
  requestId,
  limit = 20,
}: {
  requestId: string;
  limit?: number;
}): Promise<OpsCaseEvidenceRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_case_evidence")
    .select("id,request_id,type,body,meta,created_by_user_id,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(coerceEvidenceRow);
}

export async function insertCaseEvidence({
  requestId,
  type,
  body,
  meta,
  actorUserId,
  now = new Date(),
}: {
  requestId: string;
  type: CaseEvidenceType;
  body: string;
  meta?: Record<string, any> | null;
  actorUserId: string;
  now?: Date;
}): Promise<OpsCaseEvidenceRow> {
  const admin = createServiceRoleClient();
  const payload = {
    request_id: requestId,
    type,
    body,
    meta: sanitizeEvidenceMeta(meta ?? undefined),
    created_by_user_id: actorUserId,
    created_at: now.toISOString(),
  };
  const { data, error } = await admin
    .from("ops_case_evidence")
    .insert(payload)
    .select("id,request_id,type,body,meta,created_by_user_id,created_at")
    .single();
  if (error) throw error;
  return coerceEvidenceRow(data);
}
