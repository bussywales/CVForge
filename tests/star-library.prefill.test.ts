import { describe, expect, it } from "vitest";
import { buildStarDraftPrefill } from "@/lib/star-library";

describe("buildStarDraftPrefill", () => {
  it("builds a draft with metrics when evidence contains numbers", () => {
    const draft = buildStarDraftPrefill({
      gapKey: "firewall-policy",
      gapLabel: "Firewall policy governance",
      profileHeadline: "Network security lead",
      evidence: [
        {
          evidenceId: "ach:1",
          sourceId: "11111111-1111-1111-1111-111111111111",
          title: "Firewall governance",
          text: "Reduced critical rule exceptions by 30% and improved SLA compliance.",
          qualityScore: 80,
          hasMetric: true,
        },
      ],
    });

    expect(draft.title).toContain("Firewall");
    expect(draft.situation.length).toBeGreaterThan(0);
    expect(draft.task.length).toBeGreaterThan(0);
    expect(draft.action.length).toBeGreaterThan(0);
    expect(draft.result).toMatch(/30%/);
  });
});
