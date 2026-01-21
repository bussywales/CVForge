import type { BillingCorrelation } from "@/lib/billing/billing-correlation";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

export type DelayPlaybook = {
  title: string;
  severity: "low" | "med" | "high";
  summary: string;
  nextSteps: string[];
  ctas: Array<{ label: string; kind: "copy_snippet" | "recheck"; snippet?: string | null }>;
};

export function buildDelayPlaybook({
  correlation,
  supportPath,
  requestId,
}: {
  correlation: BillingCorrelation;
  supportPath: string;
  requestId?: string | null;
}): DelayPlaybook | null {
  const state = correlation.delay.state;
  const snippet =
    state !== "none" && requestId
      ? buildSupportSnippet({
          action: "Billing delay",
          path: supportPath,
          requestId,
          code: state,
        })
      : null;

  if (state === "waiting_webhook") {
    return {
      title: "Payment received — awaiting webhook",
      severity: "low",
      summary: "We’re waiting for Stripe to confirm the payment.",
      nextSteps: ["Re-check in a moment.", "If this persists, share the support snippet."],
      ctas: [{ label: "Re-check soon", kind: "recheck" }, { label: "Copy support snippet", kind: "copy_snippet", snippet }],
    };
  }
  if (state === "waiting_ledger") {
    return {
      title: "Webhook received — credits pending",
      severity: "med",
      summary: "Stripe confirmed payment; credits are still being applied.",
      nextSteps: ["Wait briefly, then re-check.", "If still pending, share the snippet."],
      ctas: [{ label: "Re-check soon", kind: "recheck" }, { label: "Copy support snippet", kind: "copy_snippet", snippet }],
    };
  }
  if (state === "ui_stale") {
    return {
      title: "Credits applied — refresh",
      severity: "low",
      summary: "Credits look applied; your page may be out of date.",
      nextSteps: ["Refresh the page to see updated credits.", "Copy a support snippet if unsure."],
      ctas: [{ label: "Copy support snippet", kind: "copy_snippet", snippet }],
    };
  }
  if (state === "unknown") {
    return {
      title: "We’re still investigating",
      severity: "med",
      summary: "Billing signals are incomplete; share the reference for support.",
      nextSteps: ["Copy the support snippet and share with support.", "Try again later if needed."],
      ctas: [{ label: "Copy support snippet", kind: "copy_snippet", snippet }],
    };
  }
  return null;
}
