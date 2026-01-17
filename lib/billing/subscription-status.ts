import "server-only";

import { fetchBillingSettings } from "@/lib/data/billing";
import { resolvePriceIdForPlan, getPlanByPriceId } from "./plans";

export type SubscriptionStatus = {
  hasActiveSubscription: boolean;
  currentPlanKey: "monthly_30" | "monthly_80" | null;
  canManageInPortal: boolean;
  availablePlans: { monthly_30: boolean; monthly_80: boolean };
};

export async function getSubscriptionStatus(
  supabase: Parameters<typeof fetchBillingSettings>[0],
  userId: string
): Promise<SubscriptionStatus> {
  const settings = await fetchBillingSettings(supabase, userId);
  const availablePlans = {
    monthly_30: Boolean(resolvePriceIdForPlan("monthly_30")),
    monthly_80: Boolean(resolvePriceIdForPlan("monthly_80")),
  };

  if (!settings) {
    return {
      hasActiveSubscription: false,
      currentPlanKey: null,
      canManageInPortal: false,
      availablePlans,
    };
  }

  const hasActiveSubscription =
    Boolean(settings.subscription_status) && settings.subscription_status !== "canceled";

  const currentPlanKey =
    getPlanKeyFromSubscription(settings.subscription_plan) ??
    getPlanKeyFromSubscriptionId(settings.stripe_subscription_id);

  return {
    hasActiveSubscription,
    currentPlanKey,
    canManageInPortal: Boolean(settings.stripe_customer_id),
    availablePlans,
  };
}

function getPlanKeyFromSubscription(planField: string | null): SubscriptionStatus["currentPlanKey"] {
  if (!planField) return null;
  if (planField.includes("monthly_80") || planField.includes("MONTHLY_80")) return "monthly_80";
  if (planField.includes("monthly_30") || planField.includes("MONTHLY_30")) return "monthly_30";
  const plan = getPlanByPriceId(planField);
  return plan?.key ?? null;
}

function getPlanKeyFromSubscriptionId(subscriptionId: string | null): SubscriptionStatus["currentPlanKey"] {
  if (!subscriptionId) return null;
  // If we ever store price id in subscription id field, attempt mapping
  const plan = getPlanByPriceId(subscriptionId);
  return plan?.key ?? null;
}
