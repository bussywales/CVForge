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
