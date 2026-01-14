import { describe, expect, it } from "vitest";
import type { RoleFitSignal } from "@/lib/role-fit";
import { buildEvidenceBank, matchSignals, rankEvidenceForGap } from "@/lib/evidence";

const signals: RoleFitSignal[] = [
  {
    id: "firewall-governance",
    label: "Firewall policy governance",
    weight: 8,
    aliases: ["firewall", "rulebase", "policy governance"],
    gapSuggestions: [],
    metricSnippets: [],
    packId: "network_security",
    packLabel: "Network/Security",
    source: "pack",
  },
];

describe("evidence helpers", () => {
  it("matches signals from evidence text", () => {
    const match = matchSignals("Owned firewall rulebase governance.", signals);
    expect(match.signalIds).toContain("firewall-governance");
  });

  it("ranks evidence for a gap", () => {
    const bank = buildEvidenceBank({
      profileHeadline: "Security lead",
      achievements: [
        {
          id: "ach-1",
          user_id: "user-1",
          title: "Firewall governance",
          situation: "",
          task: "",
          action: "Owned firewall policy governance and reviews.",
          result: "",
          metrics: "Reduced rule exceptions by 30%.",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
      workHistory: [],
      signals,
    });

    const ranked = rankEvidenceForGap("firewall-governance", bank, 1);
    expect(ranked[0]?.id).toBe("ach:ach-1");
  });
});
