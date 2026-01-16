import { describe, expect, it } from "vitest";
import { recommendPack } from "@/lib/billing/recommendation";

describe("recommendPack", () => {
  it("recommends power for heavy load", () => {
    const res = recommendPack({
      credits: 1,
      activeApplications: 6,
      dueFollowups: 5,
      practiceBacklog: 1,
      stage: "submitted",
    });
    expect(res.recommendedPack).toBe("power");
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  it("recommends pro for moderate load", () => {
    const res = recommendPack({
      credits: 2,
      activeApplications: 3,
      dueFollowups: 1,
      practiceBacklog: 0,
      stage: "draft",
    });
    expect(res.recommendedPack).toBe("pro");
  });

  it("defaults to starter otherwise", () => {
    const res = recommendPack({
      credits: 5,
      activeApplications: 0,
      dueFollowups: 0,
      practiceBacklog: 0,
      stage: "draft",
    });
    expect(res.recommendedPack).toBe("starter");
  });
});
