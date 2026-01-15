import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationRecord } from "@/lib/data/applications";
import { OUTCOME_REASON_CODES, OUTCOME_STATUSES, computeActionSummaryForApplication } from "@/lib/outcome-loop";

export type OutcomeRecord = {
  id: string;
  user_id: string;
  application_id: string;
  outcome_status: string;
  outcome_reason: string | null;
  outcome_notes: string | null;
  happened_at: string;
  created_at: string;
  updated_at: string;
};

export async function insertOutcome(
  supabase: SupabaseClient,
  userId: string,
  application: ApplicationRecord,
  payload: {
    status: string;
    reason?: string | null;
    notes?: string | null;
    happened_at?: string | null;
  }
) {
  if (!OUTCOME_STATUSES.includes(payload.status as (typeof OUTCOME_STATUSES)[number])) {
    throw new Error("Invalid outcome status");
  }
  if (payload.reason && !OUTCOME_REASON_CODES.includes(payload.reason as (typeof OUTCOME_REASON_CODES)[number])) {
    throw new Error("Invalid outcome reason");
  }

  const happenedAt = payload.happened_at ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("application_outcomes")
    .insert({
      user_id: userId,
      application_id: application.id,
      outcome_status: payload.status,
      outcome_reason: payload.reason ?? null,
      outcome_notes: payload.notes ?? null,
      happened_at: happenedAt,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await supabase
    .from("applications")
    .update({
      last_outcome_status: payload.status,
      last_outcome_reason: payload.reason ?? null,
      last_outcome_at: happenedAt,
      last_outcome_id: data.id,
    })
    .eq("id", application.id)
    .eq("user_id", userId);

  const actionSummary = await computeActionSummaryForApplication(
    supabase,
    userId,
    application.id
  );

  const actionInserts = Object.entries(actionSummary)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      user_id: userId,
      application_id: application.id,
      outcome_id: data.id,
      action_key: key,
      action_count: value,
    }));

  if (actionInserts.length) {
    const { error: linkError } = await supabase
      .from("outcome_action_links")
      .insert(actionInserts);
    if (linkError) {
      console.error("[outcome.actions]", linkError);
    }
  }

  return { outcome: data, actionSummary };
}

export async function listOutcomes(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  limit = 20
): Promise<OutcomeRecord[]> {
  const { data, error } = await supabase
    .from("application_outcomes")
    .select("*")
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("happened_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function computeOutcomeSummary(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
) {
  const outcomes = await listOutcomes(supabase, userId, applicationId, 50);
  const lastOutcome = outcomes[0] ?? null;
  const counts = outcomes.reduce(
    (acc, outcome) => {
      acc[outcome.outcome_status] = (acc[outcome.outcome_status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return { outcomes, lastOutcome, counts };
}
