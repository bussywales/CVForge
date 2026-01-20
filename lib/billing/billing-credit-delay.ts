import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";

export type CreditDelayState = "ok" | "watching" | "delayed";

export type CreditDelayResult = {
  state: CreditDelayState;
  message: string;
  nextSteps: string[];
  severity: "low" | "medium";
  requestId?: string | null;
};

export function detectCreditDelay({
  timeline,
  now = new Date(),
  windowMinutes = 15,
}: {
  timeline: BillingTimelineEntry[];
  now?: Date;
  windowMinutes?: number;
}): CreditDelayResult {
  const checkout = timeline.find((entry) => entry.kind === "checkout_success");
  if (!checkout) {
    return { state: "ok", message: "", nextSteps: [], severity: "low" };
  }

  const credits = timeline.find((entry) => entry.kind === "credits_applied" && entry.at >= checkout.at);
  if (credits) {
    return { state: "ok", message: "", nextSteps: [], severity: "low" };
  }

  const webhookError = timeline.find((entry) => entry.kind === "webhook_error");
  const checkoutTime = new Date(checkout.at);
  const diffMinutes = (now.getTime() - checkoutTime.getTime()) / (1000 * 60);
  const threshold = windowMinutes;
  const requestId = checkout.requestId ?? webhookError?.requestId ?? null;

  if (diffMinutes <= threshold) {
    return {
      state: "watching",
      severity: "low",
      message: "Payment detected — credits may still be processing.",
      nextSteps: ["Wait a moment, then refresh status.", "If this persists, share the support snippet."],
      requestId,
    };
  }

  return {
    state: "delayed",
    severity: webhookError ? "medium" : "low",
    message: webhookError ? "Payment found but webhook reported an error." : "Payment found but credits are delayed.",
    nextSteps: ["Refresh status.", "Copy the support snippet and share it with support."],
    requestId,
  };
}
