import { describe, expect, it } from "vitest";
import { computeWizardState } from "@/lib/apply-kit-wizard";

describe("computeWizardState", () => {
  it("blocks when job text is empty", () => {
    const state = computeWizardState({
      jobTextLength: 0,
      evidenceGapsWithSelection: 0,
      totalGaps: 3,
      starDraftCount: 0,
      autopackReady: false,
      submitted: false,
    });
    expect(state.nextActionId).toBe("job-text");
  });

  it("points to evidence when job text ready but no evidence", () => {
    const state = computeWizardState({
      jobTextLength: 1000,
      evidenceGapsWithSelection: 0,
      totalGaps: 3,
      starDraftCount: 0,
      autopackReady: false,
      submitted: false,
    });
    expect(state.nextActionId).toBe("evidence");
  });

  it("all ready leads to submit attention", () => {
    const state = computeWizardState({
      jobTextLength: 1200,
      evidenceGapsWithSelection: 3,
      totalGaps: 3,
      starDraftCount: 2,
      autopackReady: true,
      submitted: false,
    });
    expect(state.nextActionId).toBe("submit");
  });
});
