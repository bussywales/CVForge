import { describe, expect, it } from "vitest";
import { recommendSubscriptionPlanV2 } from "@/lib/billing/subscription-reco";

describe("recommendSubscriptionPlanV2", () => {
  it("defaults to monthly_30 for low usage", () => {
    const reco = recommendSubscriptionPlanV2({
      activeApplications: 2,
      completions7: 1,
      creditsSpent30: 10,
      topups30: 0,
    });
    expect(reco.recommendedPlanKey).toBe("monthly_30");
  });

  it("recommends monthly_80 for heavy volume", () => {
    const reco = recommendSubscriptionPlanV2({
      activeApplications: 8,
      completions7: 2,
      creditsSpent30: 20,
      topups30: 0,
    });
    expect(reco.recommendedPlanKey).toBe("monthly_80");
  });

  it("recommends monthly_80 when credits spent is high", () => {
    const reco = recommendSubscriptionPlanV2({
      activeApplications: 3,
      completions7: 2,
      creditsSpent30: 60,
      topups30: 0,
    });
    expect(reco.recommendedPlanKey).toBe("monthly_80");
  });
});
