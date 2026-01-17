import { describe, expect, it } from "vitest";
import { buildWeeklyReviewSummary } from "@/lib/weekly-review";

const week = {
  start: new Date("2024-01-01T00:00:00Z"),
  end: new Date("2024-01-08T00:00:00Z"),
};

describe("weekly review moved forward", () => {
  it("classifies reasons and counts apps moved", () => {
    const summary = buildWeeklyReviewSummary(
      {
        activities: [
          { application_id: "a1", type: "followup.sent", occurred_at: "2024-01-02T12:00:00Z" },
          { application_id: "a2", type: "apply.submitted", occurred_at: "2024-01-03T12:00:00Z" },
        ],
        outcomes: [{ application_id: "a3", happened_at: "2024-01-04T10:00:00Z" }],
        apps: [
          { id: "a1", job_title: "Role 1", company: "Co" },
          { id: "a2", job_title: "Role 2", company: "Co" },
          { id: "a3", job_title: "Role 3", company: "Co" },
        ],
      },
      week
    );

    expect(summary.applicationsMoved).toBe(3);
    const reasons = summary.examples.reduce<Record<string, string>>((acc, ex) => {
      acc[ex.applicationId] = ex.reason;
      return acc;
    }, {});
    expect(reasons.a1).toBe("followup");
    expect(reasons.a2).toBe("status_change");
    expect(reasons.a3).toBe("outcome");
    const followupExample = summary.examples.find((ex) => ex.applicationId === "a1");
    expect(followupExample?.href).toContain("tab=activity");
  });
});
