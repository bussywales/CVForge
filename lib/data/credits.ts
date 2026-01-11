import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

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

export async function deductCreditForAutopack(
  userId: string,
  autopackId: string,
  supabaseAdmin?: SupabaseClient
) {
  const serviceClient = supabaseAdmin ?? createServiceRoleClient();
  const { error } = await serviceClient.from("credit_ledger").insert({
    user_id: userId,
    delta: -1,
    reason: "autopack.generate",
    ref: autopackId,
  });

  if (error) {
    throw error;
  }
}
