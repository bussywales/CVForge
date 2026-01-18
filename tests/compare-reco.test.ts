import { describe, expect, it } from "vitest";
import { buildCompareRecommendation } from "@/lib/billing/compare-reco";

describe("compare recommendation helper", () => {
  it("recommends subscription when already subscribed", () => {
    const reco = buildCompareRecommendation({
      hasSubscription: true,
      currentPlanKey: "monthly_30",
      activeApplications: 1,
      weeklyStreakActive: false,
      completions7: 0,
      credits: 0,
      topups30: 0,
      subscriptionAvailable: true,
      packAvailability: {},
    });
    expect(reco.recommended).toBe("subscription");
    expect(reco.variant).toBe("already_subscribed");
  });

  it("recommends topup for low activity single app", () => {
    const reco = buildCompareRecommendation({
      hasSubscription: false,
      currentPlanKey: null,
      activeApplications: 1,
      weeklyStreakActive: false,
      completions7: 0,
      credits: 0,
      topups30: 0,
      subscriptionAvailable: true,
      packAvailability: { starter: true, pro: true, power: true },
    });
    expect(reco.recommended).toBe("topup");
    expect(reco.recommendedPackKey).toBe("starter");
  });

  it("recommends subscription monthly_80 for heavy usage", () => {
    const reco = buildCompareRecommendation({
      hasSubscription: false,
      currentPlanKey: null,
      activeApplications: 4,
      weeklyStreakActive: true,
      completions7: 5,
      credits: 0,
      topups30: 2,
      subscriptionAvailable: true,
      packAvailability: { starter: true, pro: true, power: true },
    });
    expect(reco.recommended).toBe("subscription");
    expect(reco.recommendedPlanKey).toBe("monthly_80");
  });
});
