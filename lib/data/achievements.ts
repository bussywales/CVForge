import type { SupabaseClient } from "@supabase/supabase-js";

export type AchievementRecord = {
  id: string;
  user_id: string;
  title: string;
  situation: string | null;
  task: string | null;
  action: string;
  result: string;
  metrics: string | null;
  created_at: string;
};

const achievementSelect =
  "id, user_id, title, situation, task, action, result, metrics, created_at";

export async function listAchievements(
  supabase: SupabaseClient,
  userId: string
): Promise<AchievementRecord[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select(achievementSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createAchievement(
  supabase: SupabaseClient,
  userId: string,
  payload: Omit<AchievementRecord, "id" | "user_id" | "created_at">
): Promise<AchievementRecord> {
  const { data, error } = await supabase
    .from("achievements")
    .insert({ ...payload, user_id: userId })
    .select(achievementSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateAchievement(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  payload: Partial<Omit<AchievementRecord, "id" | "user_id" | "created_at">>
): Promise<AchievementRecord> {
  const { data, error } = await supabase
    .from("achievements")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select(achievementSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteAchievement(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("achievements")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
