import { describe, expect, it } from "vitest";
import { getBillingOfferComparison } from "@/lib/billing/compare";

describe("billing offer comparison", () => {
  it("recommends topup when subscription unavailable", () => {
    const result = getBillingOfferComparison({
      credits: 0,
      subscriptionAvailable: false,
    });
    expect(result.recommendedChoice).toBe("topup");
  });

  it("recommends subscription when already subscribed", () => {
    const result = getBillingOfferComparison({
      credits: 5,
      hasSubscription: true,
    });
    expect(result.recommendedChoice).toBe("subscription");
  });

  it("recommends subscription when expected cadence is high", () => {
    const result = getBillingOfferComparison({
      credits: 0,
      activeApplications: 6,
      subscriptionAvailable: true,
    });
    expect(result.recommendedChoice).toBe("subscription");
  });
});
