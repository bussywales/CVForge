import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkHistoryRecord = {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  summary: string | null;
  bullets: string[];
  created_at: string;
  updated_at: string;
};

const workHistorySelect =
  "id, user_id, job_title, company, location, start_date, end_date, is_current, summary, bullets, created_at, updated_at";

export async function listWorkHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkHistoryRecord[]> {
  const { data, error } = await supabase
    .from("work_history")
    .select(workHistorySelect)
    .eq("user_id", userId)
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as WorkHistoryRecord[];
}

export async function createWorkHistory(
  supabase: SupabaseClient,
  userId: string,
  payload: Omit<WorkHistoryRecord, "id" | "user_id" | "created_at" | "updated_at">
): Promise<WorkHistoryRecord> {
  const { data, error } = await supabase
    .from("work_history")
    .insert({ ...payload, user_id: userId })
    .select(workHistorySelect)
    .single();

  if (error) {
    throw error;
  }

  return data as WorkHistoryRecord;
}

export async function updateWorkHistory(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  payload: Partial<
    Omit<WorkHistoryRecord, "id" | "user_id" | "created_at" | "updated_at">
  >
): Promise<WorkHistoryRecord> {
  const { data, error } = await supabase
    .from("work_history")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(workHistorySelect)
    .single();

  if (error) {
    throw error;
  }

  return data as WorkHistoryRecord;
}

export async function deleteWorkHistory(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("work_history")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
