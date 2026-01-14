import { describe, expect, it } from "vitest";
import { splitEvidenceTargets, type EvidenceTargetSelection } from "@/lib/evidence";

describe("splitEvidenceTargets", () => {
  it("splits evidence selections by target flags", () => {
    const selections: EvidenceTargetSelection[] = [
      {
        gapKey: "cab",
        evidenceId: "ach:1",
        useCv: true,
        useCover: false,
        useStar: true,
      },
      {
        gapKey: "siem",
        evidenceId: "wh:1:b0",
        useCv: false,
        useCover: true,
        useStar: false,
      },
    ];

    const buckets = splitEvidenceTargets(selections);

    expect(buckets.cv.map((item) => item.evidenceId)).toEqual(["ach:1"]);
    expect(buckets.cover.map((item) => item.evidenceId)).toEqual(["wh:1:b0"]);
    expect(buckets.star.map((item) => item.evidenceId)).toEqual(["ach:1"]);
  });
});
