import { describe, expect, it } from "vitest";
import { buildInterviewLift } from "../lib/interview-lift";
import type { RoleFitResult, RoleFitSignalGap } from "../lib/role-fit";

const gap: RoleFitSignalGap = {
  id: "cab",
  label: "CAB / Change Control",
  weight: 8,
  packId: "network_security",
  packLabel: "Network/Security",
  source: "pack",
  actionSuggestions: ["Managed CAB approvals to reduce change risk."],
  metricSuggestions: ["Improved change success rate to 98% in 6 months."],
  primaryAction: "Managed CAB approvals to reduce change risk.",
  shortAction: "Managed CAB approvals",
  allowActions: true,
};

const baseRoleFit: RoleFitResult = {
  score: 40,
  matchedSignals: [],
  gapSignals: [gap],
  matchedWeight: 0,
  totalWeight: 8,
  availableCount: 1,
  matchedCount: 0,
  coverage: 0,
  coveragePct: 0,
  appliedPacks: [{ id: "network_security", label: "Network/Security" }],
  fallbackUsed: false,
};

describe("interview lift", () => {
  it("builds a score and three actions", () => {
    const result = buildInterviewLift({
      roleFit: baseRoleFit,
      jobDescription: "Lead CAB and change control for critical services.",
      evidence: "",
      cvText: "- Led CAB meetings to reduce change risk.",
      coverLetter: "",
      nextActionDue: "2025-01-15",
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.actions).toHaveLength(3);
    expect(result.actions[0].title).toContain("role-evidence");
  });
});
