import type { CreditLedgerEntry } from "@/lib/data/credits";
import type { BillingStatusSnapshot } from "@/lib/billing/billing-status";

export type BillingReconcileHint = {
  show: boolean;
  message: string;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function buildBillingReconcileHint({
  lastBillingEvent,
  activity,
  now = new Date(),
}: {
  lastBillingEvent: BillingStatusSnapshot["lastBillingEvent"];
  activity: CreditLedgerEntry[];
  now?: Date;
}): BillingReconcileHint {
  if (!lastBillingEvent || lastBillingEvent.kind !== "checkout_success") {
    return { show: false, message: "" };
  }

  const eventTime = parseDate(lastBillingEvent.at) ?? now;
  const latestPositive = [...activity]
    .filter((entry) => (entry.delta ?? 0) > 0)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

  if (!latestPositive) {
    return {
      show: true,
      message: "Payment detected — credits may take a moment to appear. Refresh shortly or share your reference.",
    };
  }

  const positiveTime = parseDate(latestPositive.created_at);
  const minutesSinceCredit = positiveTime ? (now.getTime() - positiveTime.getTime()) / (1000 * 60) : null;
  const creditBeforeEvent = positiveTime ? positiveTime.getTime() < eventTime.getTime() : true;

  if (creditBeforeEvent || (minutesSinceCredit !== null && minutesSinceCredit > 15)) {
    return {
      show: true,
      message: "Payment detected but credits haven’t updated yet. Refresh or send the support snippet if it persists.",
    };
  }

  return { show: false, message: "" };
}
