import { describe, expect, it } from "vitest";
import { computeOnboardingSteps } from "@/lib/onboarding";

describe("computeOnboardingSteps", () => {
  it("progress reflects counts", () => {
    const result = computeOnboardingSteps({
      achievementsCount: 2,
      workHistoryCount: 0,
      applicationsCount: 0,
      latestApplicationId: null,
    });
    expect(result.steps.find((s) => s.id === "achievements")?.status).toBe(
      "in_progress"
    );
    expect(result.steps.find((s) => s.id === "application")?.status).toBe(
      "not_started"
    );
  });
});
