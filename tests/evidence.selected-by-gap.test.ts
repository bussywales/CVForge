import { describe, expect, it } from "vitest";
import { groupSelectedEvidenceRows } from "@/lib/data/application-evidence";

describe("groupSelectedEvidenceRows", () => {
  it("groups evidence by base gap key and dedupes by evidence id", () => {
    const rows = [
      {
        application_id: "app-1",
        gap_key: "documentation-standards::ach:1",
        evidence_id: "ach:1",
        source_type: "achievement",
        source_id: "1",
        match_score: 1,
        quality_score: 70,
      },
      {
        application_id: "app-1",
        gap_key: "documentation-standards",
        evidence_id: "ach:1",
        source_type: "achievement",
        source_id: "1",
        match_score: 1,
        quality_score: 70,
      },
      {
        application_id: "app-1",
        gap_key: "documentation-standards::wh:2:b0",
        evidence_id: "wh:2:b0",
        source_type: "work_history",
        source_id: "2",
        match_score: 0.9,
        quality_score: 60,
      },
    ];

    const grouped = groupSelectedEvidenceRows(rows);
    const entries = grouped["documentation-standards"] ?? [];

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.evidence_id)).toContain("ach:1");
    expect(entries.map((entry) => entry.evidence_id)).toContain("wh:2:b0");
  });
});
