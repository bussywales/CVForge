import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type CreditLedgerEntry = {
  id: string;
  delta: number | null;
  reason: string | null;
  ref: string | null;
  created_at: string;
};

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

export async function listCreditActivity(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, delta, reason, ref, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
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
