export type SubscriptionReco = {
  recommendedPlanKey: "monthly_30" | "monthly_80" | null;
  reasonKey: "heavy_user" | "steady_user" | "unknown" | "not_eligible";
  copy: {
    title: string;
    subtitle: string;
    bullets: string[];
  };
};

type Input = {
  credits: number;
  activeApplications: number;
  dueFollowups: number;
  practiceBacklog: number;
  autopackCount: number;
};

export function recommendSubscription(input: Input): SubscriptionReco {
  const { credits, activeApplications, dueFollowups, practiceBacklog, autopackCount } = input;

  // Heavy usage: many active apps and signals of export/practice
  if (
    activeApplications >= 8 ||
    (activeApplications >= 6 && (autopackCount >= 2 || practiceBacklog >= 5))
  ) {
    return {
      recommendedPlanKey: "monthly_80",
      reasonKey: "heavy_user",
      copy: {
        title: "Never run out mid-application",
        subtitle: "Heavy workload detected — monthly credits keep you moving.",
        bullets: [
          "Credits added automatically each month.",
          "Ideal for 6+ active applications.",
          "Cancel anytime; keep momentum.",
        ],
      },
    };
  }

  // Steady users with low balance and active work
  if (
    (credits <= 2 && activeApplications >= 2) ||
    dueFollowups > 0 ||
    autopackCount > 0 ||
    practiceBacklog > 0
  ) {
    return {
      recommendedPlanKey: "monthly_30",
      reasonKey: "steady_user",
      copy: {
        title: "Stay topped up automatically",
        subtitle: "Monthly credits prevent pauses while you apply.",
        bullets: [
          "30 credits each month for steady applications.",
          "No more surprise zero-balance moments.",
          "Cancel anytime from Billing.",
        ],
      },
    };
  }

  return {
    recommendedPlanKey: null,
    reasonKey: "not_eligible",
    copy: {
      title: "Stay topped up automatically",
      subtitle: "Monthly credits prevent pauses while you apply.",
      bullets: [
        "Credits added automatically each month.",
        "Cancel anytime from Billing.",
      ],
    },
  };
}

export type SubscriptionPlanRecommendation = {
  recommendedPlanKey: "monthly_30" | "monthly_80";
  reasonChips: string[];
  confidence: "low" | "medium" | "high";
};

export type SubscriptionSignals = {
  activeApplications?: number;
  completions7?: number;
  creditsSpent30?: number;
  topups30?: number;
};

export function recommendSubscriptionPlanV2(signals: SubscriptionSignals): SubscriptionPlanRecommendation {
  const reasons: string[] = [];
  const activeApplications = signals.activeApplications ?? 0;
  const completions7 = signals.completions7 ?? 0;
  const creditsSpent30 = signals.creditsSpent30 ?? 0;
  const topups30 = signals.topups30 ?? 0;

  if (activeApplications >= 8) {
    reasons.push("High application volume");
  }
  if (completions7 >= 8) {
    reasons.push("Frequent completions");
  }
  if (creditsSpent30 >= 50) {
    reasons.push("Heavy credit usage");
  }
  if (topups30 > 1) {
    reasons.push("Multiple top-ups recently");
  }

  const recommendedPlanKey: "monthly_30" | "monthly_80" =
    reasons.length > 0 ? "monthly_80" : "monthly_30";
  const confidence: SubscriptionPlanRecommendation["confidence"] =
    recommendedPlanKey === "monthly_80"
      ? reasons.length >= 2
        ? "high"
        : "medium"
      : "medium";

  const reasonChips =
    recommendedPlanKey === "monthly_80" && reasons.length > 0
      ? reasons.slice(0, 3)
      : ["Steady weekly applications", "Auto-resume + coach nudges"];

  return { recommendedPlanKey, reasonChips, confidence };
}
export type SubscriptionLedgerSignals = {
  completions7: number;
  creditsSpent30: number;
  topups30: number;
};

type CreditLedgerEntry = {
  delta: number | null;
  reason: string | null;
  created_at: string;
};

export function deriveSubscriptionSignalsFromLedger(
  entries: CreditLedgerEntry[]
): SubscriptionLedgerSignals {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  let completions7 = 0;
  let creditsSpent30 = 0;
  let topups30 = 0;

  entries.forEach((entry) => {
    const created = new Date(entry.created_at).getTime();
    const delta = entry.delta ?? 0;
    const within7 = now - created <= sevenDays;
    const within30 = now - created <= thirtyDays;

    if (within7 && delta < 0) {
      completions7 += 1;
    }

    if (within30) {
      if (delta < 0) {
        creditsSpent30 += Math.abs(delta);
      }
      if (delta > 0 && (entry.reason?.includes("stripe.checkout") || entry.reason?.includes("stripe"))) {
        topups30 += 1;
      }
    }
  });

  return { completions7, creditsSpent30, topups30 };
}
