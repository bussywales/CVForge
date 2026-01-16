import { describe, expect, it } from "vitest";
import { recommendSubscription } from "@/lib/billing/subscription-reco";

describe("subscription gate recommendation", () => {
  it("recommends monthly_30 when credits are low and autopacks exist", () => {
    const reco = recommendSubscription({
      credits: 0,
      activeApplications: 1,
      dueFollowups: 0,
      practiceBacklog: 0,
      autopackCount: 2,
    });
    expect(reco.recommendedPlanKey).toBe("monthly_30");
  });
});
