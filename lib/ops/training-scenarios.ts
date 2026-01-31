import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { upsertCaseQueueSource } from "@/lib/ops/ops-case-queue-store";

export type TrainingScenarioType = "alerts_test" | "mixed_basic";

export type TrainingScenarioRow = {
  id: string;
  created_at: string;
  created_by: string;
  scenario_type: string;
  window_label: string;
  event_id: string | null;
  request_id: string | null;
  acknowledged_at: string | null;
  ack_request_id: string | null;
  meta: Record<string, any>;
  is_active: boolean;
};

const SCENARIO_SELECT_FIELDS =
  "id,created_at,created_by,scenario_type,window_label,event_id,request_id,acknowledged_at,ack_request_id,meta,is_active";

function sanitizeScenarioMeta(meta?: Record<string, any>) {
  return sanitizeMonetisationMeta(meta ?? {});
}

export async function createTrainingScenario({
  type,
  userId,
  now = new Date(),
  windowLabel = "15m",
  eventId,
  requestId,
  meta,
}: {
  type: TrainingScenarioType;
  userId: string;
  now?: Date;
  windowLabel?: string;
  eventId?: string | null;
  requestId?: string | null;
  meta?: Record<string, any>;
}) {
  const admin = createServiceRoleClient();
  const payload = {
    created_at: now.toISOString(),
    created_by: userId,
    scenario_type: type,
    window_label: windowLabel,
    event_id: eventId ?? null,
    request_id: requestId ?? null,
    meta: sanitizeScenarioMeta(meta),
    is_active: true,
  };
  const { data, error } = await admin
    .from("ops_training_scenarios")
    .insert(payload)
    .select(SCENARIO_SELECT_FIELDS)
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to create training scenario");
  }
  if (data.request_id) {
    try {
      await upsertCaseQueueSource({
        requestId: data.request_id,
        code: "TRAINING",
        primarySource: "ops_training_scenarios",
        detail: `Training scenario: ${data.scenario_type}`,
        windowLabel,
        now,
      });
    } catch {
      // best-effort only
    }
  }
  return data as TrainingScenarioRow;
}

export async function listTrainingScenarios({
  userId,
  limit = 20,
  type,
  activeOnly = true,
}: {
  userId?: string | null;
  limit?: number;
  type?: string | null;
  activeOnly?: boolean;
}) {
  const admin = createServiceRoleClient();
  let query = admin
    .from("ops_training_scenarios")
    .select(SCENARIO_SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) {
    query = query.eq("created_by", userId);
  }
  if (type) {
    query = query.eq("scenario_type", type);
  }
  if (activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as TrainingScenarioRow[];
}

export async function deactivateScenario({ id }: { id: string }) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_training_scenarios")
    .update({ is_active: false })
    .eq("id", id)
    .select(SCENARIO_SELECT_FIELDS)
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to deactivate scenario");
  }
  return data as TrainingScenarioRow;
}

export async function markTrainingScenarioAcknowledged({
  scenarioId,
  eventId,
  ackRequestId,
  now = new Date(),
}: {
  scenarioId?: string | null;
  eventId?: string | null;
  ackRequestId?: string | null;
  now?: Date;
}) {
  if (!scenarioId && !eventId) {
    throw new Error("Missing scenario id or event id");
  }
  const admin = createServiceRoleClient();
  let row: TrainingScenarioRow | null = null;
  if (scenarioId) {
    const { data, error } = await admin.from("ops_training_scenarios").select(SCENARIO_SELECT_FIELDS).eq("id", scenarioId).limit(1);
    if (error) {
      throw error;
    }
    row = (data ?? [])[0] ?? null;
  } else if (eventId) {
    const { data, error } = await admin
      .from("ops_training_scenarios")
      .select(SCENARIO_SELECT_FIELDS)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      throw error;
    }
    row = (data ?? [])[0] ?? null;
  }
  if (!row) {
    throw new Error("Training scenario not found");
  }
  if (row.acknowledged_at) {
    return row;
  }

  const { data: updated, error } = await admin
    .from("ops_training_scenarios")
    .update({ acknowledged_at: now.toISOString(), ack_request_id: ackRequestId ?? row.ack_request_id ?? null })
    .eq("id", row.id)
    .select(SCENARIO_SELECT_FIELDS)
    .single();
  if (error || !updated) {
    throw error ?? new Error("Unable to mark training scenario");
  }
  return updated as TrainingScenarioRow;
}
