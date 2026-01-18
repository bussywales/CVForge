type VariantKey = "polite" | "direct" | "warm";

export type OutreachVariant = {
  key: VariantKey;
  subject: string;
  body: string;
  reason: string;
  quality: {
    lengthBand: "short" | "medium" | "long";
    hasProof: boolean;
    hasAsk: boolean;
  };
};

type Input = {
  role?: string | null;
  company?: string | null;
  contactName?: string | null;
  stage?: string | null;
  triage?: string | null;
};

export function buildOutreachVariants(input: Input): OutreachVariant[] {
  const role = input.role?.trim() || "this role";
  const company = input.company?.trim() || "your team";
  const contact = input.contactName?.trim() || "there";
  const stage = input.stage ?? "applied";
  const triage = input.triage ?? "";

  const polite: OutreachVariant = {
    key: "polite",
    subject: `Quick check-in on ${role}`,
    body: [
      `Hi ${contact},`,
      ``,
      `Hope you’re well. I applied for ${role} at ${company} and wanted to check if there’s any update you can share.`,
      `I’m keen to contribute and can share a short example of recent impact if helpful.`,
      ``,
      `Thanks for your time — appreciate any steer on next steps.`,
      ``,
      `Best,`,
      ``,
    ].join("\n"),
    reason: "Gentle nudge with offer of proof.",
    quality: {
      lengthBand: "medium",
      hasProof: true,
      hasAsk: true,
    },
  };

  const direct: OutreachVariant = {
    key: "direct",
    subject: `Next step for ${role} at ${company}?`,
    body: [
      `Hi ${contact},`,
      ``,
      `Following up on my ${stage} for ${company}. Can we confirm next steps or a short chat this week?`,
      `I can share a concise win relevant to ${company} and am ready for a quick screen.`,
      ``,
      `Thanks,`,
      ``,
    ].join("\n"),
    reason: "Clear ask and timeline.",
    quality: {
      lengthBand: "short",
      hasProof: true,
      hasAsk: true,
    },
  };

  const warm: OutreachVariant = {
    key: "warm",
    subject: `Thanks + quick follow-up on ${role}`,
    body: [
      `Hi ${contact},`,
      ``,
      triage === "interested"
        ? `Appreciate your positive reply. Sharing a quick follow-up with a relevant example and happy to align on timing.`
        : `Thanks for considering my application. I’m excited about ${company}’s work and would value a 10-minute chat on the ${role} fit.`,
      `Recent proof: shipped a project improving reliability and stakeholder comms; happy to share a snippet.`,
      `If timing isn’t right, I can check back in a few days — let me know.`,
      ``,
      `Cheers,`,
      ``,
    ].join("\n"),
    reason: "Friendly tone with specific proof.",
    quality: {
      lengthBand: "long",
      hasProof: true,
      hasAsk: true,
    },
  };

  return [polite, direct, warm];
}
