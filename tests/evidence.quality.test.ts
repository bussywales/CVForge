import { describe, expect, it } from "vitest";
import { scoreEvidenceQuality } from "@/lib/evidence";

describe("evidence quality scoring", () => {
  it("scores metrics and tooling higher than plain text", () => {
    const weak = scoreEvidenceQuality("Updated runbooks for the team.");
    const strong = scoreEvidenceQuality(
      "Reduced MTTR by 30% using ServiceNow and Splunk across 120 endpoints in 6 weeks."
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.flags.has_metric).toBe(true);
    expect(strong.flags.has_tooling).toBe(true);
  });
});
