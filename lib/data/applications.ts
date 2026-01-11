import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";

export type ApplicationRecord = {
  id: string;
  user_id: string;
  job_title: string;
  company: string | null;
  job_description: string;
  status: ApplicationStatus | string;
  created_at: string;
};

const applicationSelect =
  "id, user_id, job_title, company, job_description, status, created_at";

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
  payload: Omit<ApplicationRecord, "id" | "user_id" | "created_at">
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
  payload: Partial<Omit<ApplicationRecord, "id" | "user_id" | "created_at">>
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
