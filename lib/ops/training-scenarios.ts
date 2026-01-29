import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type TrainingScenarioType = "alerts_test" | "mixed_basic";

export type TrainingScenarioRow = {
  id: string;
  created_at: string;
  created_by: string;
  scenario_type: string;
  window_label: string;
  event_id: string | null;
  request_id: string | null;
  meta: Record<string, any>;
  is_active: boolean;
};

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
    .select("id,created_at,created_by,scenario_type,window_label,event_id,request_id,meta,is_active")
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to create training scenario");
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
    .select("id,created_at,created_by,scenario_type,window_label,event_id,request_id,meta,is_active")
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
    .select("id,created_at,created_by,scenario_type,window_label,event_id,request_id,meta,is_active")
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to deactivate scenario");
  }
  return data as TrainingScenarioRow;
}
