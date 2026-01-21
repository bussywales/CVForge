export type BillingResolutionLabel =
  | "Portal retry"
  | "Webhook delay"
  | "Checkout incomplete"
  | "Credits delayed"
  | "Non-billing issue"
  | "resolved_portal"
  | "resolved_checkout"
  | "resolved_webhook"
  | "resolved_credits_delay"
  | "needs_user"
  | "escalated"
  | "unknown";

type ReplyInput = {
  label: BillingResolutionLabel;
  delayBucket?: string | null;
  portalCode?: string | null;
  plan?: string | null;
  supportPath?: string;
  requestId?: string | null;
};

export type BillingReply = {
  subject: string;
  body: string;
  checklist: string[];
  supportLinkHint?: { path: string; label: string } | null;
};

function maskPlan(plan?: string | null) {
  if (!plan) return "your current plan";
  if (plan.includes("monthly")) return "your subscription plan";
  return "your account";
}

export function buildBillingReply(input: ReplyInput): BillingReply {
  const { label, delayBucket, portalCode, plan, supportPath, requestId } = input;
  const maskedPlan = maskPlan(plan);
  const delayNote = delayBucket ? `Delay bucket: ${delayBucket}.` : "";
  const refLine = requestId ? `Reference: ${requestId}.` : "";

  if (label === "Portal retry" || label === "resolved_portal") {
    return {
      subject: "Stripe portal retry",
      body: [
        "Hi,",
        "Thanks for your patience. Please reopen the billing portal and try again. If you still see an error, share the reference below.",
        delayNote,
        portalCode ? `Portal code: ${portalCode}.` : "",
        refLine,
      ]
        .filter(Boolean)
        .join(" "),
      checklist: ["Open billing portal", "Confirm plan/credits", "Let us know if the issue persists"],
      supportLinkHint: supportPath ? { path: supportPath, label: "Billing portal" } : null,
    };
  }
  if (label === "Webhook delay" || label === "resolved_webhook") {
    return {
      subject: "Payment received — awaiting confirmation",
      body: ["Hi,", "We saw your payment; Stripe is still confirming it. Credits will appear shortly.", delayNote, refLine].filter(Boolean).join(" "),
      checklist: ["Wait a moment, then refresh billing", "If still pending, reply with this reference"],
    };
  }
  if (label === "Checkout incomplete" || label === "resolved_checkout") {
    return {
      subject: "Checkout did not complete",
      body: ["Hi,", "It looks like the checkout didn’t complete. Please retry the purchase and confirm.", refLine].filter(Boolean).join(" "),
      checklist: ["Retry checkout", "Confirm updated credits", "If blocked, reply with the reference"],
    };
  }
  if (label === "Credits delayed" || label === "resolved_credits_delay") {
    return {
      subject: "Credits are being applied",
      body: ["Hi,", `Your payment is confirmed; credits for ${maskedPlan} are being applied.`, delayNote, refLine].filter(Boolean).join(" "),
      checklist: ["Refresh billing", "Check credit balance", "Share the reference if still missing"],
      supportLinkHint: supportPath ? { path: supportPath, label: "Open billing" } : null,
    };
  }
  if (label === "needs_user" || label === "escalated") {
    return {
      subject: "We need more info to close this",
      body: ["Hi,", "We need a quick confirmation to close this billing issue. Please reply with what you see now.", refLine].filter(Boolean).join(" "),
      checklist: ["Refresh billing", "Confirm credits and plan", "Reply with what you see now"],
    };
  }
  return {
    subject: "Billing update",
    body: ["Hi,", "We reviewed your account. No billing issues were detected. If you still see a problem, reply with the reference.", refLine]
      .filter(Boolean)
      .join(" "),
    checklist: ["Refresh billing", "Confirm credits and plan", "Reply with details if anything looks off"],
  };
}
