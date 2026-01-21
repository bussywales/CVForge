import "server-only";

import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import type { BillingCorrelation } from "@/lib/billing/billing-correlation";
import type { CreditDelayResult } from "@/lib/billing/billing-credit-delay";
import type { WebhookReceipt } from "@/lib/webhook-receipts";

export type WebhookStatusState = "ok" | "not_expected" | "watching" | "delayed";

export type WebhookReasonCode =
  | "NO_RECENT_CHECKOUT"
  | "CREDIT_APPLIED"
  | "RECEIPT_SEEN"
  | "EXPECTED_WAITING"
  | "DELAY_BUCKET_WAITING_WEBHOOK"
  | "DELAY_BUCKET_WAITING_LEDGER"
  | "DELAY_BUCKET_UI_STALE"
  | "DELAY_BUCKET_UNKNOWN"
  | "UNKNOWN";

export type WebhookStatusV2 = {
  state: WebhookStatusState;
  reasonCode: WebhookReasonCode;
  message: string;
  facts: { hasRecentCheckout: boolean; lastReceiptAt?: string | null; lastCreditAt?: string | null; expectedWindowMins: number };
};

type Input = {
  timeline: BillingTimelineEntry[];
  webhookReceipt?: WebhookReceipt | null;
  correlation?: BillingCorrelation | null;
  delay?: CreditDelayResult | BillingCorrelation["delay"] | null;
  expectedWindowMins?: number;
  now?: Date;
};

function pickLatest<T extends { at: string | null }>(a: T | null, b: T | null) {
  if (!a) return b;
  if (!b) return a;
  return (b.at ?? "") > (a.at ?? "") ? b : a;
}

export function buildWebhookStatusV2({
  timeline,
  webhookReceipt,
  correlation,
  delay,
  expectedWindowMins = 20,
  now = new Date(),
}: Input): WebhookStatusV2 {
  const checkoutLikeKinds: BillingTimelineEntry["kind"][] = ["checkout_success", "checkout_started", "checkout_error", "portal_error", "portal_open"];
  const lastCheckoutLike = timeline.find((entry) => checkoutLikeKinds.includes(entry.kind)) ?? null;
  const lastWebhook = webhookReceipt?.lastWebhookAt
    ? { at: webhookReceipt.lastWebhookAt }
    : timeline.find((entry) => entry.kind === "webhook_received") ?? null;
  const lastCredit = timeline.find((entry) => entry.kind === "credits_applied") ?? null;
  const hasRecentCheckout =
    Boolean(lastCheckoutLike) && now.getTime() - new Date((lastCheckoutLike as any).at ?? "").getTime() <= 24 * 60 * 60 * 1000;

  const facts = {
    hasRecentCheckout,
    lastReceiptAt: (lastWebhook as any)?.at ?? null,
    lastCreditAt: (lastCredit as any)?.at ?? null,
    expectedWindowMins,
  };

  if (!hasRecentCheckout) {
    return {
      state: "not_expected",
      reasonCode: "NO_RECENT_CHECKOUT",
      message: "No recent checkout — webhooks aren’t expected right now.",
      facts,
    };
  }

  if (lastWebhook) {
    return {
      state: "ok",
      reasonCode: "RECEIPT_SEEN",
      message: "Webhook received recently.",
      facts,
    };
  }

  if (lastCredit && (!lastCheckoutLike || (lastCredit as any).at >= (lastCheckoutLike as any).at)) {
    return {
      state: "ok",
      reasonCode: "CREDIT_APPLIED",
      message: "Credits applied — webhook likely processed.",
      facts,
    };
  }

  const checkoutAt = lastCheckoutLike?.at ? new Date(lastCheckoutLike.at).getTime() : null;
  const minutesSinceCheckout = checkoutAt ? (now.getTime() - checkoutAt) / (1000 * 60) : null;

  const delayState = delay ?? correlation?.delay ?? null;
  const mapDelayReason = (): WebhookReasonCode => {
    if (!delayState) return "DELAY_BUCKET_UNKNOWN";
    if (delayState.state === "waiting_webhook") return "DELAY_BUCKET_WAITING_WEBHOOK";
    if (delayState.state === "waiting_ledger") return "DELAY_BUCKET_WAITING_LEDGER";
    if (delayState.state === "ui_stale") return "DELAY_BUCKET_UI_STALE";
    if (delayState.state === "unknown") return "DELAY_BUCKET_UNKNOWN";
    return "UNKNOWN";
  };

  if (minutesSinceCheckout !== null && minutesSinceCheckout <= expectedWindowMins) {
    return {
      state: "watching",
      reasonCode: "EXPECTED_WAITING",
      message: "Payment detected — webhook may still arrive within the window.",
      facts,
    };
  }

  const reasonCode = mapDelayReason();
  return {
    state: "delayed",
    reasonCode,
    message: "Webhook taking longer than expected — share a support snippet.",
    facts,
  };
}

export type { WebhookReceipt } from "@/lib/webhook-receipts";
