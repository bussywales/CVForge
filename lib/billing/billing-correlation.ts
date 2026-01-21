import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import type { CreditLedgerEntry } from "@/lib/data/credits";

export type BillingCorrelation = {
  correlation: {
    checkout: { at: string | null; requestId?: string | null; ok: boolean };
    webhook: { at: string | null; requestId?: string | null; ok: boolean };
    ledger: { at: string | null; deltaCredits?: number | null; ok: boolean };
  };
  delay: {
    state: "none" | "waiting_webhook" | "waiting_ledger" | "ui_stale" | "unknown";
    since?: string | null;
    confidence: "low" | "med" | "high";
    explanation: string;
  };
  evidence: string[];
};

type CorrelationInput = {
  timeline: BillingTimelineEntry[];
  ledger: CreditLedgerEntry[];
  creditsAvailable?: number;
  now?: Date;
};

function findLatest(entries: BillingTimelineEntry[], kind: BillingTimelineEntry["kind"]) {
  return entries.find((entry) => entry.kind === kind) ?? null;
}

export function createBillingCorrelation({ timeline, ledger, creditsAvailable, now = new Date() }: CorrelationInput): BillingCorrelation {
  const checkout = findLatest(timeline, "checkout_success");
  const webhook = timeline.find((entry) => entry.kind === "webhook_received" && (!checkout || entry.at >= checkout.at)) ?? null;
  const webhookError = timeline.find((entry) => entry.kind === "webhook_error" && (!checkout || entry.at >= checkout.at)) ?? null;
  const creditEntries = timeline.filter((entry) => entry.kind === "credits_applied").sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const latestCredit = creditEntries[0] ?? null;
  const ledgerEntry = creditEntries.find((entry) => (!checkout || entry.at >= checkout.at)) ?? null;
  const ledgerDelta = ledger.find((entry) => (entry.delta ?? 0) > 0 && (!checkout || entry.created_at >= checkout.at)) ?? null;

  const correlation = {
    checkout: { at: checkout?.at ?? null, requestId: checkout?.requestId ?? null, ok: Boolean(checkout) },
    webhook: { at: (webhook ?? webhookError)?.at ?? null, requestId: (webhook ?? webhookError)?.requestId ?? null, ok: Boolean(webhook) },
    ledger: { at: ledgerEntry?.at ?? ledgerDelta?.created_at ?? latestCredit?.at ?? null, deltaCredits: ledgerDelta?.delta ?? null, ok: Boolean(ledgerEntry || ledgerDelta || latestCredit) },
  };

  const evidence: string[] = [];
  if (checkout) evidence.push(`checkout@${checkout.at}`);
  if (webhook) evidence.push(`webhook@${webhook.at}`);
  if (webhookError) evidence.push(`webhook_error@${webhookError.at}`);
  if (ledgerEntry) evidence.push(`credits@${ledgerEntry.at}`);
  if (ledgerDelta && !ledgerEntry) evidence.push(`ledger_delta@${ledgerDelta.created_at}`);
  if (typeof creditsAvailable === "number") evidence.push(`credits=${creditsAvailable}`);

  const nowTs = now.getTime();
  const checkoutTs = checkout ? new Date(checkout.at).getTime() : null;
  const webhookTs = webhook ? new Date(webhook.at).getTime() : null;
  const ledgerTs = (ledgerEntry?.at ?? ledgerDelta?.created_at ?? latestCredit?.at)
    ? new Date((ledgerEntry?.at ?? ledgerDelta?.created_at ?? latestCredit?.at) as string).getTime()
    : null;
  const creditsBeforeCheckout = latestCredit && checkout ? latestCredit.at < checkout.at : false;

  let delayState: BillingCorrelation["delay"] = {
    state: "none",
    confidence: "low",
    explanation: "No billing delay detected.",
  };

  if (!checkout) {
    delayState = { state: "none", confidence: "low", explanation: "No recent checkout signals found." };
  } else if (creditsBeforeCheckout) {
    delayState = {
      state: "ui_stale",
      since: latestCredit?.at ?? ledgerDelta?.created_at ?? null,
      confidence: "low",
      explanation: "Credits applied — your page may be out of date.",
    };
  } else if (!webhook && !ledgerTs) {
    delayState = {
      state: "waiting_webhook",
      since: checkout.at,
      confidence: "high",
      explanation: "Payment received — waiting for Stripe webhook confirmation.",
    };
  } else if (webhook && !ledgerTs) {
    delayState = {
      state: "waiting_ledger",
      since: webhook.at,
      confidence: "high",
      explanation: "Webhook received — waiting for credits to be applied.",
    };
  } else if (ledgerTs && checkoutTs && ledgerTs >= checkoutTs && webhookError && (!webhook || webhookTs === null)) {
    delayState = {
      state: "unknown",
      since: webhookError.at,
      confidence: "med",
      explanation: "We saw a webhook error after checkout; please share the support snippet.",
    };
  } else if (ledgerTs && checkoutTs && ledgerTs >= checkoutTs && webhookTs && ledgerTs < webhookTs) {
    delayState = {
      state: "ui_stale",
      since: ledgerEntry?.at ?? ledgerDelta?.created_at ?? null,
      confidence: "low",
      explanation: "Credits applied — your page may be out of date.",
    };
  } else {
    delayState = {
      state: "none",
      confidence: "low",
      explanation: "Billing events look healthy.",
    };
  }

  // If checkout is older than 30 minutes and still no ledger/webhook, mark unknown for visibility
  const staleCheckout = checkoutTs && nowTs - checkoutTs > 30 * 60 * 1000 && !ledgerTs;
  if ((delayState.state === "none" || delayState.state === "waiting_webhook") && staleCheckout) {
    delayState = {
      state: "unknown",
      since: checkout?.at ?? null,
      confidence: "med",
      explanation: "We’re still investigating — share the support snippet.",
    };
  }

  return { correlation, delay: delayState, evidence };
}
