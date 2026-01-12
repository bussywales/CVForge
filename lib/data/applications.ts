import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatusValue } from "@/lib/application-status";

export type ApplicationRecord = {
  id: string;
  user_id: string;
  job_title: string;
  company: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  job_url: string | null;
  job_description: string;
  status: ApplicationStatusValue | string;
  applied_at: string | null;
  last_touch_at: string | null;
  next_followup_at: string | null;
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
  contact_email?: string | null;
  job_url?: string | null;
  applied_at?: string | null;
  last_touch_at?: string | null;
  next_followup_at?: string | null;
  source?: string | null;
};

export type ApplicationUpdate = Partial<ApplicationInsert>;

const applicationSelect =
  "id, user_id, job_title, company, company_name, contact_name, contact_email, job_url, job_description, status, applied_at, last_touch_at, next_followup_at, source, created_at";

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
