import { describe, expect, it } from "vitest";
import { computeOutreachInsight } from "@/lib/outreach-insights";

describe("outreach insights", () => {
  it("computes reply rate and tip", () => {
    const insight = computeOutreachInsight([
      { type: "outreach" },
      { type: "outreach" },
      { type: "outreach.triage" },
      { type: "followup" },
    ]);

    expect(insight.sent).toBe(2);
    expect(insight.replies).toBe(1);
    expect(insight.replyRate).toBe(50);
    expect(insight.tip).toContain("Great reply rate");
  });
});
