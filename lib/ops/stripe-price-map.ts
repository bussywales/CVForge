import { resolvePriceIdForPlan } from "@/lib/billing/plans";

const ENV_PRICE_IDS = {
  monthly_30: resolvePriceIdForPlan("monthly_30"),
  monthly_80: resolvePriceIdForPlan("monthly_80"),
};

export function mapStripePriceToPlanKey(priceId?: string | null): string | null {
  if (!priceId) return null;
  const entries = Object.entries(ENV_PRICE_IDS).filter(([, value]) => Boolean(value)) as Array<[string, string]>;
  const match = entries.find(([, value]) => value === priceId);
  if (match) return match[0];
  if (priceId.toLowerCase().includes("monthly_30")) return "monthly_30";
  if (priceId.toLowerCase().includes("monthly_80")) return "monthly_80";
  return "unknown";
}
