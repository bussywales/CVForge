import { describe, expect, it } from "vitest";
import { buildNextBestActions } from "@/lib/next-best-actions";

describe("next best actions", () => {
  it("orders by priority and limits to three", () => {
    const actions = buildNextBestActions({
      applicationId: "app-1",
      closingDate: null,
      pendingApplyItems: 2,
      jobTextStatus: "blocked",
      hasJobText: false,
      roleFitGaps: 3,
      starDraftCount: 0,
      practiceTotal: 5,
      practiceScored: 1,
      hasDueFollowup: true,
    });

    expect(actions.length).toBe(3);
    expect(actions[0].id).toBe("set-closing-date");
    expect(actions[1].id).toBe("complete-checklist");
    expect(actions[2].id).toBe("paste-job-text");
  });
});
