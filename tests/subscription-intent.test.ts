import { describe, expect, it } from "vitest";
import { recommendSubscriptionIntent } from "@/lib/billing/subscription-intent";

describe("subscription intent recommendation", () => {
  it("recommends monthly_80 for heavy usage", () => {
    const result = recommendSubscriptionIntent({
      credits: 2,
      paidActionReady: true,
      completionsThisWeek: 6,
      activeApps: 6,
    });
    expect(result.shouldShow).toBe(true);
    expect(result.recommendedPlan).toBe("monthly_80");
  });

  it("recommends monthly_30 for light intent", () => {
    const result = recommendSubscriptionIntent({
      credits: 5,
      paidActionReady: true,
      completionsThisWeek: 2,
      activeApps: 2,
    });
    expect(result.shouldShow).toBe(true);
    expect(result.recommendedPlan).toBe("monthly_30");
  });

  it("suppresses when no intent signals", () => {
    const result = recommendSubscriptionIntent({
      credits: 5,
      paidActionReady: false,
      completionsThisWeek: 0,
      activeApps: 1,
      checkoutCompletedRecently: true,
    });
    expect(result.shouldShow).toBe(false);
  });
});
