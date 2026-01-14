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
  use_cv: boolean | null;
  use_cover: boolean | null;
  use_star: boolean | null;
  created_at: string;
  updated_at: string | null;
};

export type ApplicationEvidenceRow = Omit<
  ApplicationEvidenceRecord,
  "id" | "user_id" | "created_at"
>;

export type SelectedEvidenceByGap = Record<string, ApplicationEvidenceRow[]>;

const evidenceSelect =
  "id, user_id, application_id, gap_key, evidence_id, source_type, source_id, match_score, quality_score, use_cv, use_cover, use_star, created_at, updated_at";

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

export async function listApplicationEvidenceIds(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("application_evidence")
    .select("evidence_id")
    .eq("user_id", userId)
    .eq("application_id", applicationId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => row.evidence_id)
    .filter((id): id is string => typeof id === "string");
}

export async function listApplicationEvidenceRows(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<ApplicationEvidenceRow[]> {
  const { data, error } = await supabase
    .from("application_evidence")
    .select(
      "application_id, gap_key, evidence_id, source_type, source_id, match_score, quality_score, use_cv, use_cover, use_star, updated_at"
    )
    .eq("user_id", userId)
    .eq("application_id", applicationId);

  if (error) {
    throw error;
  }

  return (data ?? []) as ApplicationEvidenceRow[];
}

export async function getSelectedEvidenceForApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<SelectedEvidenceByGap> {
  const { data, error } = await supabase
    .from("application_evidence")
    .select(
      "application_id, gap_key, evidence_id, source_type, source_id, match_score, quality_score, use_cv, use_cover, use_star, updated_at"
    )
    .eq("user_id", userId)
    .eq("application_id", applicationId);

  if (error) {
    throw error;
  }

  return groupSelectedEvidenceRows((data ?? []) as ApplicationEvidenceRow[]);
}

export async function removeApplicationEvidence(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  gapKey: string,
  evidenceId: string
): Promise<void> {
  const storedKey = buildEvidenceGapKey(gapKey, evidenceId);
  const { error } = await supabase
    .from("application_evidence")
    .delete()
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .eq("evidence_id", evidenceId)
    .in("gap_key", [gapKey, storedKey]);

  if (error) {
    throw error;
  }
}

export async function updateEvidenceTargets(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  gapKey: string,
  evidenceId: string,
  payload: { use_cv: boolean; use_cover: boolean; use_star: boolean }
): Promise<ApplicationEvidenceRecord> {
  const storedKey = buildEvidenceGapKey(gapKey, evidenceId);
  const { data, error } = await supabase
    .from("application_evidence")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .eq("evidence_id", evidenceId)
    .in("gap_key", [gapKey, storedKey])
    .select(evidenceSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as ApplicationEvidenceRecord;
}

export function groupSelectedEvidenceRows(
  rows: ApplicationEvidenceRow[]
): SelectedEvidenceByGap {
  const grouped: SelectedEvidenceByGap = {};

  rows.forEach((row) => {
    const gapKey = normalizeGapKey(row.gap_key);
    if (!grouped[gapKey]) {
      grouped[gapKey] = [];
    }
    const exists = grouped[gapKey].some(
      (entry) => entry.evidence_id === row.evidence_id
    );
    if (!exists) {
      grouped[gapKey].push({ ...row, gap_key: gapKey });
    }
  });

  return grouped;
}

export function normalizeGapKey(value: string) {
  const [base] = value.split("::");
  return base;
}

export function buildEvidenceGapKey(gapKey: string, evidenceId: string) {
  return `${gapKey}::${evidenceId}`;
}
