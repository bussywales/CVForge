import "server-only";

import { SUBSCRIPTION_PLANS, getPlanByKey, type SubscriptionPlan } from "./plans-data";

export { SUBSCRIPTION_PLANS, getPlanByKey } from "./plans-data";

function getPlanEnv() {
  return {
    monthly_30: process.env.STRIPE_SUB_MONTHLY_30_PRICE_ID ?? null,
    monthly_80: process.env.STRIPE_SUB_MONTHLY_80_PRICE_ID ?? null,
  };
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
