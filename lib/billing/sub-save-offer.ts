export type SaveOfferVariant = "DOWNGRADE" | "KEEP" | "TOPUP_FALLBACK";

export type SaveOfferReco = {
  variant: SaveOfferVariant;
  recommendedPlan?: "monthly_30" | "monthly_80";
  reasons: string[];
  portalFlow: string;
  portalPlan?: "monthly_30" | "monthly_80";
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
};

export function recommendSaveOffer(input: {
  planKey: "monthly_30" | "monthly_80";
  creditsUsed: number;
  completions: number;
  movedForward: number;
  risk: "low" | "medium" | "high";
}): SaveOfferReco {
  // Default KEEP
  const keep: SaveOfferReco = {
    variant: "KEEP",
    recommendedPlan: input.planKey,
    reasons: buildReasons(input),
    portalFlow: "keep",
    portalPlan: input.planKey,
    primaryCtaLabel: "Keep going",
  };

  if (input.planKey === "monthly_80") {
    return {
      variant: "DOWNGRADE",
      recommendedPlan: "monthly_30",
      reasons: [
        "You can switch to Monthly 30 and keep access.",
        "Change anytime in Stripe.",
      ],
      portalFlow: "downgrade",
      portalPlan: "monthly_30",
      primaryCtaLabel: "Keep going",
      secondaryCtaLabel: "Switch to Monthly 30",
    };
  }

  // Heavy usage on Monthly 30: recommend keeping
  if (input.planKey === "monthly_30" && (input.creditsUsed >= 15 || input.risk === "high")) {
    return keep;
  }

  // Low usage: suggest top-ups instead
  if (input.completions === 0 && input.movedForward === 0) {
    return {
      variant: "TOPUP_FALLBACK",
      recommendedPlan: "monthly_30",
      reasons: [
        "Usage was light this week.",
        "Try top-ups for occasional usage.",
      ],
      portalFlow: "keep",
      portalPlan: "monthly_30",
      primaryCtaLabel: "Keep going",
    };
  }

  return keep;
}

function buildReasons(input: { creditsUsed: number; completions: number; movedForward: number; risk: string }) {
  const reasons: string[] = [];
  if (input.creditsUsed > 0) reasons.push("Recent activity detected");
  if (input.movedForward > 0) reasons.push("Applications moved forward this week");
  if (input.risk === "high") reasons.push("Stay subscribed to avoid losing momentum");
  return reasons.slice(0, 3);
}
