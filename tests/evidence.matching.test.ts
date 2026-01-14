import { describe, expect, it } from "vitest";
import type { RoleFitSignal } from "@/lib/role-fit";
import { scoreEvidenceMatch } from "@/lib/evidence";

const documentationSignal: RoleFitSignal = {
  id: "documentation-standards",
  label: "Documentation / standards",
  weight: 5,
  aliases: ["documentation", "standards", "procedures", "runbook", "playbook", "sop"],
  gapSuggestions: [],
  metricSnippets: [],
  packId: "core",
  packLabel: "Core",
  source: "pack",
};

describe("evidence matching", () => {
  it("matches documentation aliases via overlap", () => {
    const score = scoreEvidenceMatch(
      "Created runbooks, standards and procedures for operational handover.",
      documentationSignal
    );
    expect(score).toBeGreaterThanOrEqual(0.6);
  });
});
