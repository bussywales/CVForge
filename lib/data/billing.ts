import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingSettings = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  auto_topup_enabled: boolean;
  auto_topup_pack_key: string | null;
  auto_topup_threshold: number;
  created_at: string;
  updated_at: string;
};

export async function fetchBillingSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<BillingSettings | null> {
  const { data, error } = await supabase
    .from("billing_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data as BillingSettings | null;
}

export async function upsertBillingSettings(
  supabase: SupabaseClient,
  userId: string,
  payload: Partial<BillingSettings>
): Promise<BillingSettings | null> {
  const { data, error } = await supabase
    .from("billing_settings")
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as BillingSettings;
}
