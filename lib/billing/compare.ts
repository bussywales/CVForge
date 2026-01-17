import { CREDIT_PACKS } from "@/lib/billing/packs-data";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans-data";

export type BillingChoice = "subscription" | "topup";

export type CompareRow = {
  label: string;
  topup: string;
  subscription: string;
};

export type CompareResult = {
  recommendedChoice: BillingChoice;
  reasons: string[];
  rows: CompareRow[];
  suggestedPlanKey: "monthly_30" | "monthly_80";
  suggestedPackKey: string;
  subscriptionAvailable: boolean;
};

export type CompareContext = {
  credits: number;
  activeApplications?: number;
  recentCompletions30?: number;
  pendingAction?: boolean;
  hasSubscription?: boolean;
  recommendedPlanKey?: "monthly_30" | "monthly_80" | null;
  recommendedPackKey?: string | null;
  subscriptionAvailable?: boolean;
};

function getExpectedMonthlyActions(ctx: CompareContext) {
  if (ctx.recentCompletions30 && ctx.recentCompletions30 > 0) {
    return ctx.recentCompletions30;
  }
  const active = ctx.activeApplications ?? 0;
  if (active >= 6) return 8;
  if (active >= 3) return 5;
  if (active >= 1) return 3;
  if (ctx.pendingAction) return 1;
  return 1;
}

function pickPlan(expectedActions: number, requested?: "monthly_30" | "monthly_80" | null) {
  const preferred = requested ?? (expectedActions >= 6 ? "monthly_80" : "monthly_30");
  return preferred;
}

export function getBillingOfferComparison(ctx: CompareContext): CompareResult {
  const subscriptionAvailable = ctx.subscriptionAvailable ?? true;

  if (ctx.hasSubscription) {
    const planKey = ctx.recommendedPlanKey ?? "monthly_30";
    return {
      recommendedChoice: "subscription",
      reasons: [
        "Covers your next actions",
        "Avoids repeated top-ups",
        "Keeps you in flow (auto-resume)",
      ],
      rows: buildRows(planKey),
      suggestedPlanKey: planKey,
      suggestedPackKey: ctx.recommendedPackKey ?? CREDIT_PACKS[0].key,
      subscriptionAvailable,
    };
  }

  if (!subscriptionAvailable) {
    return {
      recommendedChoice: "topup",
      reasons: ["Covers your next actions", "Keeps you in flow (auto-resume)"],
      rows: buildRows("monthly_30"),
      suggestedPlanKey: "monthly_30",
      suggestedPackKey: ctx.recommendedPackKey ?? CREDIT_PACKS[0].key,
      subscriptionAvailable,
    };
  }

  const expected = getExpectedMonthlyActions(ctx);
  const choice: BillingChoice = expected >= 4 ? "subscription" : "topup";
  const planKey = pickPlan(expected, ctx.recommendedPlanKey ?? null);

  const reasons =
    choice === "subscription"
      ? [
          "Better value at your pace",
          "Avoids repeated top-ups",
          "Best for 2–3+ applications/week",
        ]
      : ["Covers your next actions", "Keeps you in flow (auto-resume)"];

  return {
    recommendedChoice: choice,
    reasons,
    rows: buildRows(planKey),
    suggestedPlanKey: planKey,
    suggestedPackKey: ctx.recommendedPackKey ?? CREDIT_PACKS[0].key,
    subscriptionAvailable,
  };
}

function buildRows(planKey: "monthly_30" | "monthly_80"): CompareRow[] {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.key === planKey) ?? SUBSCRIPTION_PLANS[0];
  return [
    {
      label: "Covers this month",
      topup: "One action",
      subscription: `Up to ${plan.creditsPerMonth} credits`,
    },
    {
      label: "Best for",
      topup: "One application now",
      subscription: "2–3+ applications/week",
    },
    {
      label: "Keep momentum",
      topup: "Manual top-ups",
      subscription: "Auto-resume & weekly coach nudges",
    },
  ];
}
