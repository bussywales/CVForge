import { describe, expect, it } from "vitest";
import { deriveBillingTriageNextStep } from "@/lib/ops/ops-billing-triage";

const baseLocal = {
  subscriptionStatus: "active",
  creditsAvailable: 2,
  lastBillingEvent: { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z" },
  flags: { portalError: false, fromOpsSupport: false },
} as any;

const baseStripe = {
  hasCustomer: true,
  hasSubscription: true,
  subscriptionStatus: "active" as const,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2024-02-15T00:00:00.000Z",
  priceKey: "monthly_30",
  latestInvoiceStatus: "paid",
  lastPaymentErrorCode: null,
};

describe("deriveBillingTriageNextStep", () => {
  it("suggests refresh when local active but stripe canceled", () => {
    const next = deriveBillingTriageNextStep({
      local: baseLocal,
      stripe: { ...baseStripe, subscriptionStatus: "canceled" },
    });
    expect(next.message).toContain("Stripe is canceled");
    expect(next.billingLink).toContain("from=ops_support");
  });

  it("prompts payment update on past_due", () => {
    const next = deriveBillingTriageNextStep({
      local: baseLocal,
      stripe: { ...baseStripe, subscriptionStatus: "past_due" },
    });
    expect(next.message.toLowerCase()).toContain("payment");
    expect(next.portalLink).toContain("/api/billing/portal");
  });

  it("adds pack hint when checkout success but credits low", () => {
    const next = deriveBillingTriageNextStep({
      local: { ...baseLocal, creditsAvailable: 1 },
      stripe: { ...baseStripe },
    });
    expect(next.message.toLowerCase()).toContain("credits");
    expect(next.billingLink).toContain("pack=starter");
  });
});
