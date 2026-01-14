import type { SupabaseClient } from "@supabase/supabase-js";

export type StarLibraryRecord = {
  id: string;
  user_id: string;
  application_id: string;
  gap_key: string;
  signal_key: string | null;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  evidence_ids: string[];
  quality_hint: string | null;
  created_at: string;
  updated_at: string | null;
};

const starSelect =
  "id, user_id, application_id, gap_key, signal_key, title, situation, task, action, result, evidence_ids, quality_hint, created_at, updated_at";

export async function listStarLibrary(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<StarLibraryRecord[]> {
  const { data, error } = await supabase
    .from("star_library")
    .select(starSelect)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as StarLibraryRecord[];
}

export async function fetchStarLibraryByGap(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  gapKey: string
): Promise<StarLibraryRecord | null> {
  const { data, error } = await supabase
    .from("star_library")
    .select(starSelect)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .eq("gap_key", gapKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchStarLibraryById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<StarLibraryRecord | null> {
  const { data, error } = await supabase
    .from("star_library")
    .select(starSelect)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function upsertStarLibrary(
  supabase: SupabaseClient,
  userId: string,
  payload: Omit<StarLibraryRecord, "id" | "user_id" | "created_at">
): Promise<StarLibraryRecord> {
  const { data, error } = await supabase
    .from("star_library")
    .upsert(
      {
        ...payload,
        user_id: userId,
      },
      { onConflict: "user_id,application_id,gap_key" }
    )
    .select(starSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as StarLibraryRecord;
}

export async function updateStarLibrary(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  payload: Partial<
    Pick<StarLibraryRecord, "title" | "situation" | "task" | "action" | "result">
  >
): Promise<StarLibraryRecord> {
  const { data, error } = await supabase
    .from("star_library")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", id)
    .select(starSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as StarLibraryRecord;
}
