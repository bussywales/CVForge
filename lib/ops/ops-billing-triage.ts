import type { BillingStatusSnapshot } from "@/lib/billing/billing-status";

export type StripeSnapshot = {
  hasCustomer: boolean;
  hasSubscription: boolean;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "none";
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  priceKey?: string | null;
  latestInvoiceStatus?: string | null;
  lastPaymentErrorCode?: string | null;
};

export type BillingTriageNextStep = {
  message: string;
  billingLink: string;
  portalLink: string;
  packKey?: string;
  planParam?: string | null;
};

export function deriveBillingTriageNextStep({
  local,
  stripe,
  baseBillingUrl = "/app/billing?from=ops_support&support=1",
  portalUrl = "/api/billing/portal?mode=navigation",
}: {
  local: BillingStatusSnapshot;
  stripe: StripeSnapshot;
  baseBillingUrl?: string;
  portalUrl?: string;
}): BillingTriageNextStep {
  const planParam = stripe.priceKey && stripe.priceKey !== "unknown" ? stripe.priceKey : null;
  const packKey = local.creditsAvailable < 3 ? "starter" : undefined;
  const billingLinkBase = planParam ? `${baseBillingUrl}&plan=${encodeURIComponent(planParam)}` : baseBillingUrl;
  const billingLink = packKey ? `${billingLinkBase}&pack=${packKey}` : billingLinkBase;

  if (local.subscriptionStatus === "active" && stripe.subscriptionStatus === "canceled") {
    return {
      message: "Local shows active but Stripe is canceled — ask user to refresh and re-open the portal; confirm period end.",
      billingLink,
      portalLink: portalUrl,
      planParam,
    };
  }

  if (stripe.subscriptionStatus === "past_due" || stripe.subscriptionStatus === "incomplete") {
    return {
      message: "Stripe is past due — ask the user to update payment method in the portal and retry.",
      billingLink,
      portalLink: portalUrl,
      planParam,
    };
  }

  if (stripe.subscriptionStatus === "active" && local.creditsAvailable < 3 && local.lastBillingEvent?.kind === "checkout_success") {
    return {
      message: "Checkout succeeded but credits look low — share reconcile hint, wait a minute, then refresh.",
      billingLink,
      portalLink: portalUrl,
      packKey,
      planParam,
    };
  }

  return {
    message: "Open Billing with ops flags to guide the user.",
    billingLink: packKey ? `${billingLink}&pack=${packKey}` : billingLink,
    portalLink: portalUrl,
    packKey,
    planParam,
  };
}
