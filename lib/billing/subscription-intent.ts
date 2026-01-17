type PlanKey = "monthly_30" | "monthly_80";

export type SubscriptionIntentSignals = {
  credits: number;
  paidActionReady: boolean;
  checkoutStartedRecently?: boolean;
  checkoutReturnedRecently?: boolean;
  checkoutCompletedRecently?: boolean;
  lowCreditImpressions7d?: number;
  completionsThisWeek?: number;
  activeApps?: number;
  streakSaverEligible?: boolean;
  streakSaverDismissed?: boolean;
};

export type SubscriptionIntentReco = {
  shouldShow: boolean;
  recommendedPlan: PlanKey;
  reasons: string[];
};

const REASONS = {
  momentum: "Lock in momentum for paid actions.",
  lowCredits: "Avoid running out mid-week.",
  heavy: "Best value if you’re applying daily.",
  streak: "Keeps your streak going even when credits dip.",
  recovery: "Finish checkout without friction.",
};

export function recommendSubscriptionIntent(input: SubscriptionIntentSignals): SubscriptionIntentReco {
  const completions = input.completionsThisWeek ?? 0;
  const activeApps = input.activeApps ?? 0;
  const lowCreditImpressions = input.lowCreditImpressions7d ?? 0;
  const heavy = completions >= 6 || activeApps >= 6;
  const shouldShow = Boolean(
    !input.checkoutCompletedRecently &&
      (
        (input.credits > 0 && input.paidActionReady) ||
        ((input.checkoutStartedRecently || input.checkoutReturnedRecently) && !input.checkoutCompletedRecently) ||
        (input.streakSaverEligible && input.streakSaverDismissed) ||
        lowCreditImpressions >= 2
      )
  );

  const recommendedPlan: PlanKey = heavy || completions >= 5 ? "monthly_80" : "monthly_30";
  const reasons: string[] = [];
  if (input.paidActionReady) reasons.push(REASONS.momentum);
  if (input.credits <= 2) reasons.push(REASONS.lowCredits);
  if (heavy) reasons.push(REASONS.heavy);
  if (input.streakSaverEligible) reasons.push(REASONS.streak);
  if (input.checkoutStartedRecently || input.checkoutReturnedRecently) reasons.push(REASONS.recovery);

  return {
    shouldShow,
    recommendedPlan,
    reasons: reasons.slice(0, 3),
  };
}
