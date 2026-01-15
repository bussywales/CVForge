import { describe, expect, it } from "vitest";
import { detectWeakestStep } from "@/lib/coach-mode";

describe("detectWeakestStep", () => {
  it("prioritises follow-up when overdue", () => {
    const weakest = detectWeakestStep({
      overdueFollowups: 2,
      missingJobDetails: 3,
      lowEvidence: 1,
      missingStar: 1,
      firstOverdueApp: "app1",
    });
    expect(weakest.id).toBe("followup");
  });
});
