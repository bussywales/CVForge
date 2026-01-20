export const OPS_PLAYBOOK_COPY = {
  customerReply: {
    portal: (requestId: string | null | undefined) =>
      `Thanks for your patience — we see your billing portal session had an issue. Your reference is ${requestId ?? "the reference shown"}. Please try this billing link to reopen the portal and we'll stay on the line to confirm it loads.`,
    checkout: (requestId: string | null | undefined) =>
      `We saw a checkout issue on our side (ref ${requestId ?? "n/a"}). Please try the new billing link below to complete your purchase. If it still fails, reply here and we’ll take it to Stripe immediately.`,
    webhook: (requestId: string | null | undefined) =>
      `We’re checking an automated billing update (ref ${requestId ?? "n/a"}) that didn’t verify cleanly. Your access stays unchanged while we confirm the Stripe event — we’ll update you once it’s applied.`,
    credits: (requestId: string | null | undefined) =>
      `We’re reconciling your credits (ref ${requestId ?? "n/a"}) and have queued a manual fix. You’ll see the corrected balance shortly — thanks for flagging this.`,
    monetisation: (requestId: string | null | undefined) =>
      `We noticed a transient billing signal issue (ref ${requestId ?? "n/a"}). We’re double-checking the last action and will confirm once everything is applied. No further action needed from you right now.`,
  },
} as const;

export type PlaybookCopyId = keyof typeof OPS_PLAYBOOK_COPY.customerReply;
