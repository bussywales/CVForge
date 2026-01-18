export const OPS_COPY = {
  supportActions: "Support actions",
  manualCredit: "Manual credit adjustment",
  applyCredit: "Apply credit adjustment",
  supportLink: "Support link",
  copyLink: "Copy link",
  appliedBalance: (balance: number) => `Applied. New balance: ${balance}`,
  creditError: "Couldn't apply adjustment. Try again.",
  linkError: "Couldn't generate link. Try again.",
  recentAudit: "Recent ops actions",
} as const;
