export type SubscriptionPlan = {
  key: "monthly_30" | "monthly_80";
  name: string;
  priceGbp: number;
  creditsPerMonth: number;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: "monthly_30",
    name: "Monthly 30",
    priceGbp: 12,
    creditsPerMonth: 30,
  },
  {
    key: "monthly_80",
    name: "Monthly 80",
    priceGbp: 24,
    creditsPerMonth: 80,
  },
];

export function getPlanByKey(key?: string | null): SubscriptionPlan | null {
  if (!key) return null;
  return SUBSCRIPTION_PLANS.find((plan) => plan.key === key) ?? null;
}
