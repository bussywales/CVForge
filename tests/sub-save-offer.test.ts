import { describe, expect, it } from "vitest";
import { recommendSaveOffer } from "@/lib/billing/sub-save-offer";

describe("sub save offer recommender", () => {
  it("suggests downgrade on monthly_80", () => {
    const reco = recommendSaveOffer({
      planKey: "monthly_80",
      creditsUsed: 5,
      completions: 0,
      movedForward: 0,
      risk: "high",
    });
    expect(reco.variant).toBe("DOWNGRADE");
    expect(reco.portalFlow).toBe("downgrade");
    expect(reco.portalPlan).toBe("monthly_30");
  });

  it("keeps plan on monthly_30 with high usage", () => {
    const reco = recommendSaveOffer({
      planKey: "monthly_30",
      creditsUsed: 20,
      completions: 2,
      movedForward: 1,
      risk: "medium",
    });
    expect(reco.variant).toBe("KEEP");
    expect(reco.portalFlow).toBe("keep");
  });
});
