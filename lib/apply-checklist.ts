import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyChecklistRecord = {
  id: string;
  user_id: string;
  application_id: string;
  cv_exported_at: string | null;
  cover_exported_at: string | null;
  interview_pack_exported_at: string | null;
  kit_downloaded_at: string | null;
  outreach_step1_logged_at: string | null;
  followup_scheduled_at: string | null;
  submitted_logged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplyChecklistUpdate = Partial<
  Pick<
    ApplyChecklistRecord,
    | "cv_exported_at"
    | "cover_exported_at"
    | "interview_pack_exported_at"
    | "kit_downloaded_at"
    | "outreach_step1_logged_at"
    | "followup_scheduled_at"
    | "submitted_logged_at"
  >
>;

const checklistSelect =
  "id, user_id, application_id, cv_exported_at, cover_exported_at, interview_pack_exported_at, kit_downloaded_at, outreach_step1_logged_at, followup_scheduled_at, submitted_logged_at, created_at, updated_at";

export async function fetchApplyChecklist(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<ApplyChecklistRecord | null> {
  const { data, error } = await supabase
    .from("application_apply_checklist")
    .select(checklistSelect)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getOrCreateApplyChecklist(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<ApplyChecklistRecord> {
  const existing = await fetchApplyChecklist(supabase, userId, applicationId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("application_apply_checklist")
    .insert({ user_id: userId, application_id: applicationId })
    .select(checklistSelect)
    .single();

  if (error) {
    const fallback = await fetchApplyChecklist(supabase, userId, applicationId);
    if (fallback) {
      return fallback;
    }
    throw error;
  }

  return data;
}

export async function markApplyChecklist(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  fields: ApplyChecklistUpdate
): Promise<ApplyChecklistRecord | null> {
  await getOrCreateApplyChecklist(supabase, userId, applicationId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("application_apply_checklist")
    .update({ ...fields, updated_at: now })
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .select(checklistSelect)
    .single();

  if (error) {
    throw error;
  }

  return data ?? null;
}
