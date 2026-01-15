import { describe, expect, it } from "vitest";
import { computeKitChecklist } from "@/lib/application-kit";

describe("computeKitChecklist next actions", () => {
  it("prioritises autopack then outreach then practice", () => {
    const result = computeKitChecklist({
      applicationId: "app-1",
      achievements: [],
      autopack: null,
      checklist: {
        interview_pack_exported_at: null,
      },
      closingDate: null,
      submittedAt: null,
      practiceQuestions: [],
      practiceAnswers: {},
      starDrafts: [],
      activities: [],
      outreachStage: null,
      nextActionDue: null,
      contactName: "Hiring Manager",
      status: "draft",
    });

    expect(result.nextActions[0]?.id).toBe("autopack");
    expect(result.nextActions[1]?.id).toBe("outreach");
    expect(result.nextActions[2]?.id).toBe("practice");
  });
});
