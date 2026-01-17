import { describe, expect, it } from "vitest";
import { buildWeeklyCoachPlan } from "@/lib/weekly-coach";

describe("weekly coach plan", () => {
  it("prioritises overdue followups and gates autopack when out of credits", () => {
    const now = new Date("2024-01-04T12:00:00Z");
    const plan = buildWeeklyCoachPlan(
      {
        activeApps: [
          {
            id: "app1",
            company: "Acme",
            role: "Engineer",
            nextActionDue: "2024-01-03T10:00:00Z",
            hasJobText: true,
            hasEvidenceSelected: true,
            hasStarDraft: true,
            hasAutopack: true,
            hasAnswerPack: true,
          },
          {
            id: "app2",
            company: "Beta",
            role: "Analyst",
            nextActionDue: null,
            hasJobText: true,
            hasEvidenceSelected: false,
            hasStarDraft: true,
            hasAutopack: true,
            hasAnswerPack: true,
          },
          {
            id: "app3",
            company: "Gamma",
            role: "PM",
            nextActionDue: null,
            hasJobText: true,
            hasEvidenceSelected: true,
            hasStarDraft: true,
            hasAutopack: false,
            hasAnswerPack: true,
          },
        ],
        hasCredits: false,
        isSubscribed: false,
      },
      now
    );

    expect(plan.actions.length).toBeGreaterThanOrEqual(3);
    expect(plan.actions.length).toBeLessThanOrEqual(5);
    expect(plan.actions[0].type).toBe("followup");
    expect(plan.actions.some((action) => action.type === "billing")).toBe(true);
    expect(plan.actions.some((action) => action.type === "autopack")).toBe(false);

    const counts: Record<string, number> = {};
    plan.actions.forEach((action) => {
      counts[action.type] = (counts[action.type] ?? 0) + 1;
      expect(counts[action.type]).toBeLessThanOrEqual(2);
    });
  });
});
