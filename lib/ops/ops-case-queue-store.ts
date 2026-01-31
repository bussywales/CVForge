import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getOrCreateCaseWorkflow } from "@/lib/ops/ops-case-workflow";
import {
  buildCaseReasonSource,
  coerceCaseReasonSources,
  mergeCaseReasonSources,
  resolveCaseReason,
  type CaseReason,
  type CaseReasonCode,
  type CaseReasonSource,
} from "@/lib/ops/ops-case-reason";

export type OpsCaseQueueRow = {
  request_id: string;
  last_touched_at: string;
  reason_code: string | null;
  reason_title: string | null;
  reason_detail: string | null;
  reason_primary_source: string | null;
  reason_computed_at: string | null;
  sources: CaseReasonSource[];
  created_at: string;
  updated_at: string;
};

export async function getCaseQueueRow(requestId: string): Promise<OpsCaseQueueRow | null> {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_case_queue")
    .select(
      "request_id,last_touched_at,reason_code,reason_title,reason_detail,reason_primary_source,reason_computed_at,sources,created_at,updated_at"
    )
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    request_id: data.request_id,
    last_touched_at: data.last_touched_at,
    reason_code: data.reason_code ?? null,
    reason_title: data.reason_title ?? null,
    reason_detail: data.reason_detail ?? null,
    reason_primary_source: data.reason_primary_source ?? null,
    reason_computed_at: data.reason_computed_at ?? null,
    sources: coerceCaseReasonSources(data.sources),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function buildReasonPayload(reason: CaseReason) {
  return {
    reason_code: reason.code,
    reason_title: reason.title,
    reason_detail: reason.detail,
    reason_primary_source: reason.primarySource,
    reason_computed_at: reason.computedAt,
  };
}

export async function upsertCaseQueueSources({
  requestId,
  sources,
  lastTouchedAt,
  now = new Date(),
  windowLabel,
}: {
  requestId: string;
  sources: CaseReasonSource[];
  lastTouchedAt?: string | null;
  now?: Date;
  windowLabel?: string | null;
}) {
  if (!requestId) return null;
  const admin = createServiceRoleClient();
  await getOrCreateCaseWorkflow({ requestId, now });

  const existing = await getCaseQueueRow(requestId);
  const mergedSources = mergeCaseReasonSources([...(existing?.sources ?? []), ...sources]);
  const { reason } = resolveCaseReason({ sources: mergedSources, windowLabel, now });
  const nextTouched = lastTouchedAt ?? sources[0]?.lastSeenAt ?? now.toISOString();
  const resolvedTouched = existing?.last_touched_at
    ? new Date(existing.last_touched_at).getTime() >= new Date(nextTouched).getTime()
      ? existing.last_touched_at
      : nextTouched
    : nextTouched;
  const payload = {
    request_id: requestId,
    last_touched_at: resolvedTouched,
    sources: mergedSources,
    updated_at: now.toISOString(),
    ...buildReasonPayload(reason),
  };
  if (existing) {
    const { data, error } = await admin
      .from("ops_case_queue")
      .update(payload)
      .eq("request_id", requestId)
      .select(
        "request_id,last_touched_at,reason_code,reason_title,reason_detail,reason_primary_source,reason_computed_at,sources,created_at,updated_at"
      )
      .single();
    if (error) throw error;
    return data as OpsCaseQueueRow;
  }
  const insertPayload = {
    ...payload,
    created_at: now.toISOString(),
  };
  const { data, error } = await admin
    .from("ops_case_queue")
    .insert(insertPayload)
    .select(
      "request_id,last_touched_at,reason_code,reason_title,reason_detail,reason_primary_source,reason_computed_at,sources,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  return data as OpsCaseQueueRow;
}

export async function upsertCaseQueueSource({
  requestId,
  code,
  primarySource,
  detail,
  windowLabel,
  count = 1,
  now = new Date(),
}: {
  requestId: string;
  code: CaseReasonCode;
  primarySource: string;
  detail?: string | null;
  windowLabel?: string | null;
  count?: number;
  now?: Date;
}) {
  const source = buildCaseReasonSource({
    code,
    primarySource,
    count,
    detail: detail ?? null,
    lastSeenAt: now.toISOString(),
    windowLabel,
  });
  return upsertCaseQueueSources({
    requestId,
    sources: [source],
    lastTouchedAt: source.lastSeenAt,
    now,
    windowLabel,
  });
}

