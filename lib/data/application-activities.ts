import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicationActivityRecord = {
  id: string;
  user_id: string;
  application_id: string;
  type: string;
  channel: string | null;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_at: string;
};

const activitySelect =
  "id, user_id, application_id, type, channel, subject, body, occurred_at, created_at";

export async function listApplicationActivities(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<ApplicationActivityRecord[]> {
  const { data, error } = await supabase
    .from("application_activities")
    .select(activitySelect)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createApplicationActivity(
  supabase: SupabaseClient,
  userId: string,
  payload: Omit<ApplicationActivityRecord, "id" | "user_id" | "created_at">
): Promise<ApplicationActivityRecord> {
  const { data, error } = await supabase
    .from("application_activities")
    .insert({ ...payload, user_id: userId })
    .select(activitySelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteApplicationActivity(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("application_activities")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
