const allowedReasons = ["Goodwill", "Refund", "Manual correction"] as const;

export type CreditPayload = { userId: string | null; amount: number; reason: string | null; note: string | null };

export function validateCreditPayload({ userId, amount, reason, note }: CreditPayload) {
  if (!userId) {
    return { ok: false, code: "INVALID_USER", message: "User is required." };
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be an integer between -500 and 500, not zero." };
  }
  if (!reason || !allowedReasons.includes(reason as (typeof allowedReasons)[number])) {
    return { ok: false, code: "INVALID_REASON", message: "Reason is required." };
  }
  if (note && note.length > 140) {
    return { ok: false, code: "INVALID_NOTE", message: "Note too long." };
  }
  return { ok: true as const };
}

export function normaliseReason(reason: string) {
  return reason.toLowerCase().replace(" ", "_");
}
