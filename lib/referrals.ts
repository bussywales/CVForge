import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const REFERRAL_PREFIX = "cvf-";
const INVITER_CREDITS = 3;
const INVITEE_CREDITS = 3;

export function generateReferralCode() {
  return `${REFERRAL_PREFIX}${nanoid(8)}`;
}

export async function ensureReferralCode(
  supabase: SupabaseClient,
  userId: string
): Promise<{ code: string } | null> {
  const { data, error } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.code) return { code: data.code };
  const code = generateReferralCode();
  const { error: insertError } = await supabase
    .from("referral_codes")
    .insert({ user_id: userId, code });
  if (insertError) return null;
  return { code };
}

export async function redeemReferral(
  supabase: SupabaseClient,
  inviterUserId: string,
  inviteeUserId: string,
  code: string
) {
  const { data: existing } = await supabase
    .from("referral_redemptions")
    .select("id")
    .eq("invitee_user_id", inviteeUserId)
    .maybeSingle();
  if (existing) {
    return { alreadyRedeemed: true };
  }

  await supabase.from("referral_redemptions").insert({
    inviter_user_id: inviterUserId,
    invitee_user_id: inviteeUserId,
    code,
  });

  // Insert credits idempotently: rely on unique ref per user/reason
  const inserts = [
    {
      user_id: inviterUserId,
      delta: INVITER_CREDITS,
      reason: "referral.inviter",
      ref: inviteeUserId,
    },
    {
      user_id: inviteeUserId,
      delta: INVITEE_CREDITS,
      reason: "referral.invitee",
      ref: inviterUserId,
    },
  ];

  for (const row of inserts) {
    const { data: dupe } = await supabase
      .from("credit_ledger")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("reason", row.reason)
      .eq("ref", row.ref)
      .maybeSingle();
    if (!dupe) {
      await supabase.from("credit_ledger").insert(row);
    }
  }

  return { awarded: { inviter: INVITER_CREDITS, invitee: INVITEE_CREDITS } };
}
