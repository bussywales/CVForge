import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatusValue } from "@/lib/application-status";

export type ApplicationRecord = {
  id: string;
  user_id: string;
  job_title: string;
  company: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_linkedin: string | null;
  job_url: string | null;
  job_description: string;
  job_text: string | null;
  job_text_source: string | null;
  job_fetched_at: string | null;
  job_fetch_status: string | null;
  job_fetch_error: string | null;
  job_fetch_etag: string | null;
  job_fetch_last_modified: string | null;
  job_text_hash: string | null;
  job_source_url: string | null;
  status: ApplicationStatusValue | string;
  selected_evidence: unknown;
  applied_at: string | null;
  closing_date: string | null;
  submitted_at: string | null;
  source_platform: string | null;
  last_activity_at: string | null;
  last_touch_at: string | null;
  star_drafts: unknown;
  last_lift_action: string | null;
  lift_completed_at: string | null;
  next_action_type: string | null;
  next_action_due: string | null;
  next_followup_at: string | null;
  outreach_stage: string | null;
  outreach_last_sent_at: string | null;
  outreach_next_due_at: string | null;
  outreach_channel_pref: string | null;
  source: string | null;
  created_at: string;
};

export type ApplicationInsert = Pick<
  ApplicationRecord,
  "job_title" | "job_description" | "status"
> & {
  company?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_linkedin?: string | null;
  job_url?: string | null;
  job_text?: string | null;
  job_text_source?: string | null;
  job_fetched_at?: string | null;
  job_fetch_status?: string | null;
  job_fetch_error?: string | null;
  job_fetch_etag?: string | null;
  job_fetch_last_modified?: string | null;
  job_text_hash?: string | null;
  job_source_url?: string | null;
  selected_evidence?: unknown;
  applied_at?: string | null;
  closing_date?: string | null;
  submitted_at?: string | null;
  source_platform?: string | null;
  last_activity_at?: string | null;
  last_touch_at?: string | null;
  star_drafts?: unknown;
  last_lift_action?: string | null;
  lift_completed_at?: string | null;
  next_action_type?: string | null;
  next_action_due?: string | null;
  next_followup_at?: string | null;
  outreach_stage?: string | null;
  outreach_last_sent_at?: string | null;
  outreach_next_due_at?: string | null;
  outreach_channel_pref?: string | null;
  source?: string | null;
};

export type ApplicationUpdate = Partial<ApplicationInsert>;

const applicationSelect =
  "id, user_id, job_title, company, company_name, contact_name, contact_role, contact_email, contact_linkedin, job_url, job_description, job_text, job_text_source, job_fetched_at, job_fetch_status, job_fetch_error, job_fetch_etag, job_fetch_last_modified, job_text_hash, job_source_url, status, selected_evidence, applied_at, closing_date, submitted_at, source_platform, last_activity_at, last_touch_at, star_drafts, last_lift_action, lift_completed_at, next_action_type, next_action_due, next_followup_at, outreach_stage, outreach_last_sent_at, outreach_next_due_at, outreach_channel_pref, source, created_at";

export async function listApplications(
  supabase: SupabaseClient,
  userId: string
): Promise<ApplicationRecord[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchApplication(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ApplicationRecord | null> {
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelect)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function createApplication(
  supabase: SupabaseClient,
  userId: string,
  payload: ApplicationInsert
): Promise<ApplicationRecord> {
  const { data, error } = await supabase
    .from("applications")
    .insert({ ...payload, user_id: userId })
    .select(applicationSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateApplication(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  payload: ApplicationUpdate
): Promise<ApplicationRecord> {
  const { data, error } = await supabase
    .from("applications")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(applicationSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteApplication(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
