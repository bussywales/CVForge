import { describe, expect, it } from "vitest";
import { recommendSubscription } from "@/lib/billing/subscription-reco";

describe("subscription reco", () => {
  it("returns null when no signals", () => {
    const reco = recommendSubscription({
      credits: 5,
      activeApplications: 0,
      dueFollowups: 0,
      practiceBacklog: 0,
      autopackCount: 0,
    });
    expect(reco.recommendedPlanKey).toBeNull();
    expect(reco.reasonKey).toBe("not_eligible");
  });

  it("recommends monthly_30 for steady low balance", () => {
    const reco = recommendSubscription({
      credits: 1,
      activeApplications: 3,
      dueFollowups: 1,
      practiceBacklog: 0,
      autopackCount: 0,
    });
    expect(reco.recommendedPlanKey).toBe("monthly_30");
    expect(reco.reasonKey).toBe("steady_user");
  });
});
