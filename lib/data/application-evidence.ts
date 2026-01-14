import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicationEvidenceRecord = {
  id: string;
  user_id: string;
  application_id: string;
  gap_key: string;
  evidence_id: string;
  source_type: string | null;
  source_id: string | null;
  match_score: number | null;
  quality_score: number | null;
  created_at: string;
};

const evidenceSelect =
  "id, user_id, application_id, gap_key, evidence_id, source_type, source_id, match_score, quality_score, created_at";

export async function upsertApplicationEvidence(
  supabase: SupabaseClient,
  userId: string,
  payload: Omit<ApplicationEvidenceRecord, "id" | "user_id" | "created_at">
): Promise<ApplicationEvidenceRecord> {
  const { data, error } = await supabase
    .from("application_evidence")
    .upsert(
      {
        ...payload,
        user_id: userId,
      },
      { onConflict: "user_id,application_id,gap_key" }
    )
    .select(evidenceSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as ApplicationEvidenceRecord;
}
