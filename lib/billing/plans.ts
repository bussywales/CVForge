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

function getPlanEnv() {
  return {
    monthly_30: process.env.STRIPE_SUB_MONTHLY_30_PRICE_ID ?? null,
    monthly_80: process.env.STRIPE_SUB_MONTHLY_80_PRICE_ID ?? null,
  };
}

export function getPlanByKey(key?: string | null): SubscriptionPlan | null {
  if (!key) return null;
  return SUBSCRIPTION_PLANS.find((plan) => plan.key === key) ?? null;
}

export function resolvePriceIdForPlan(key: string): string | null {
  const env = getPlanEnv();
  return env[key as keyof typeof env] ?? null;
}

export function getPlanByPriceId(priceId?: string | null): SubscriptionPlan | null {
  if (!priceId) return null;
  const env = getPlanEnv();
  const match = Object.entries(env).find(([, value]) => value === priceId);
  if (!match) return null;
  return getPlanByKey(match[0]);
}
