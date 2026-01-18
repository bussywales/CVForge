export type CompareRecommendationVariant = "weekly_momentum" | "single_push" | "heavy_user_upgrade" | "already_subscribed";

export type CompareRecommendation = {
  recommended: "subscription" | "topup";
  recommendedPlanKey?: "monthly_30" | "monthly_80";
  recommendedPackKey?: "starter" | "pro" | "power";
  reasons: string[];
  variant: CompareRecommendationVariant;
};

export function buildCompareRecommendation({
  hasSubscription,
  currentPlanKey,
  activeApplications,
  weeklyStreakActive,
  completions7,
  credits,
  topups30,
  subscriptionAvailable,
  packAvailability,
}: {
  hasSubscription: boolean;
  currentPlanKey?: "monthly_30" | "monthly_80" | null;
  activeApplications: number;
  weeklyStreakActive?: boolean;
  completions7: number;
  credits: number;
  topups30: number;
  subscriptionAvailable: boolean;
  packAvailability: Partial<Record<"starter" | "pro" | "power", boolean>>;
}): CompareRecommendation {
  if (hasSubscription) {
    return {
      recommended: "subscription",
      recommendedPlanKey: currentPlanKey ?? "monthly_30",
      reasons: ["You already have a subscription.", "Manage or adjust your plan anytime.", "Keep momentum with weekly usage."],
      variant: "already_subscribed",
    };
  }

  const weeklyMomentum = weeklyStreakActive || activeApplications >= 2 || completions7 >= 3;
  if (weeklyMomentum) {
    const heavy = completions7 >= 5 || activeApplications >= 4 || topups30 >= 2;
    const planKey: "monthly_30" | "monthly_80" = heavy ? "monthly_80" : "monthly_30";
    return {
      recommended: "subscription",
      recommendedPlanKey: subscriptionAvailable ? planKey : undefined,
      reasons: [
        "Recommended because you’re building weekly momentum.",
        heavy ? "Your usage fits the Monthly 80 plan." : "Keep shipping without pausing for top-ups.",
      ],
      variant: heavy ? "heavy_user_upgrade" : "weekly_momentum",
    };
  }

  const heavyButNoSub = activeApplications >= 3 || completions7 >= 2;
  if (heavyButNoSub && subscriptionAvailable) {
    return {
      recommended: "subscription",
      recommendedPlanKey: "monthly_30",
      reasons: ["Recommended because you’re building weekly momentum.", "Stay unblocked through the week."],
      variant: "weekly_momentum",
    };
  }

  const packKey: "starter" | "pro" | "power" =
    heavyButNoSub && (packAvailability.power ?? true)
      ? "power"
      : credits > 0 && (packAvailability.pro ?? true)
        ? "pro"
        : "starter";

  return {
    recommended: "topup",
    recommendedPackKey: packKey,
    reasons: [
      "Recommended because you’re in a focused push right now.",
      packKey === "power" ? "Gives more runway without subscribing." : "Pay once, use when needed.",
    ],
    variant: "single_push",
  };
}
