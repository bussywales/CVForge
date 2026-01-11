import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUserCredits(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, entry) => sum + (entry.delta ?? 0), 0);
}
