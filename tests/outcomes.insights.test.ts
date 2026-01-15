import { describe, expect, it } from "vitest";
import { buildOutcomeInsights } from "@/lib/outcome-loop";

describe("buildOutcomeInsights", () => {
  it("returns not enough data when fewer than 3 outcomes", () => {
    const insights = buildOutcomeInsights(
      [{ outcome_status: "submitted" }],
      []
    );
    expect(insights[0]?.text).toContain("Not enough outcome data");
  });

  it("includes interview/evidence hint when enough data", () => {
    const insights = buildOutcomeInsights(
      [
        { outcome_status: "interview_scheduled" },
        { outcome_status: "interview_completed" },
        { outcome_status: "offer" },
      ],
      [{ action_key: "evidence_selected", action_count: 2 }]
    );
    expect(
      insights.some((insight) => insight.text.includes("evidence"))
    ).toBe(true);
  });
});
