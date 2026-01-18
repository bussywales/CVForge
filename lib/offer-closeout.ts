export type CloseoutApp = {
  id: string;
  role: string;
  company: string;
  status: string;
  contactEmail?: string | null;
  contactLinkedin?: string | null;
  outreachStage?: string | null;
  nextActionDue?: string | null;
};

export function buildCloseoutList(apps: CloseoutApp[], acceptedId: string) {
  return apps
    .filter((app) => app.id !== acceptedId)
    .filter((app) => !["rejected", "withdrawn", "closed", "offer"].includes(app.status ?? ""));
}

type VariantKey = "warm" | "direct" | "short";

export function buildWithdrawalTemplates(input: {
  role?: string | null;
  company?: string | null;
  contactName?: string | null;
}): Record<VariantKey, { subject: string; body: string }> {
  const role = input.role || "the role";
  const company = input.company || "your team";
  const contact = input.contactName || "there";

  const warm = {
    subject: `Withdrawing from ${role}`,
    body: [
      `Hi ${contact},`,
      ``,
      `Thanks for considering me for ${role}. I've accepted another offer and need to withdraw from this process.`,
      `I appreciate the time with ${company} and hope we can stay in touch.`,
      ``,
      `Best,`,
      ``,
    ].join("\n"),
  };

  const direct = {
    subject: `Withdraw application - ${role}`,
    body: [
      `Hi ${contact},`,
      ``,
      `Please withdraw my application for ${role}. I've accepted another offer.`,
      `Thanks for your time.`,
      ``,
    ].join("\n"),
  };

  const short = {
    subject: `Withdraw from ${role}`,
    body: `Hi ${contact}, I've accepted another offer and will withdraw from ${role}. Thanks for your time.`,
  };

  return { warm, direct, short };
}
