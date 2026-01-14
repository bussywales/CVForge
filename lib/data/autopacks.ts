import type { SupabaseClient } from "@supabase/supabase-js";

export type AutopackRecord = {
  id: string;
  application_id: string;
  user_id: string;
  version: number;
  cv_text: string | null;
  cover_letter: string | null;
  answers_json: unknown;
  evidence_trace: unknown;
  created_at: string;
};

const autopackSelect =
  "id, application_id, user_id, version, cv_text, cover_letter, answers_json, evidence_trace, created_at";

export async function listAutopacks(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<AutopackRecord[]> {
  const { data, error } = await supabase
    .from("autopacks")
    .select(autopackSelect)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("version", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchAutopack(
  supabase: SupabaseClient,
  userId: string,
  autopackId: string
): Promise<AutopackRecord | null> {
  const { data, error } = await supabase
    .from("autopacks")
    .select(autopackSelect)
    .eq("id", autopackId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchLatestAutopackVersion(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("autopacks")
    .select("version")
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.version ?? 0;
}
