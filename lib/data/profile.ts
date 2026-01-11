import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileRecord = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  created_at: string;
};

const profileSelect = "user_id, full_name, headline, location, created_at";

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRecord | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRecord> {
  const existing = await fetchProfile(supabase, userId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId, full_name: "" })
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  payload: Pick<ProfileRecord, "full_name" | "headline" | "location">
): Promise<ProfileRecord> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        full_name: payload.full_name,
        headline: payload.headline,
        location: payload.location,
      },
      { onConflict: "user_id" }
    )
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
