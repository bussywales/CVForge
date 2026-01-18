import { describe, expect, it } from "vitest";
import { buildNextBestActions } from "@/lib/next-best-actions";

describe("outcome-driven next actions", () => {
  const baseInput = {
    applicationId: "app-1",
    pendingApplyItems: 0,
    roleFitGaps: 0,
    starDraftCount: 1,
    practiceTotal: 0,
    practiceScored: 0,
  };

  it("prioritises follow-up when no response", () => {
    const actions = buildNextBestActions({
      ...baseInput,
      lastOutcomeStatus: "no_response",
      hasDueFollowup: true,
    });
    expect(actions[0]?.id).toBe("send-followup");
  });

  it("suggests new application after rejection", () => {
    const actions = buildNextBestActions({
      ...baseInput,
      lastOutcomeStatus: "rejected",
    });
    expect(actions[0]?.id).toBe("start-new-application");
  });

  it("suggests interview prep when interview scheduled", () => {
    const actions = buildNextBestActions({
      ...baseInput,
      lastOutcomeStatus: "interview_scheduled",
    });
    expect(actions.find((a) => a.id === "interview-focus")).toBeTruthy();
  });
});
