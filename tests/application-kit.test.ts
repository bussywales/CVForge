import { describe, expect, it } from "vitest";
import { computeKitChecklist } from "@/lib/application-kit";

describe("computeKitChecklist", () => {
  it("recommends generating an autopack when missing", () => {
    const result = computeKitChecklist({
      applicationId: "app-1",
      profileHeadline: "Security Engineer",
      profileName: "Test User",
      userEmail: "test@example.com",
      achievements: [],
      autopack: null,
      checklist: null,
      closingDate: null,
      submittedAt: null,
      nextActionDue: null,
      practiceQuestions: [],
      practiceAnswers: {},
      starDrafts: [],
      outreachStage: "not_started",
      activities: [],
    });

    expect(result.nextActions[0]?.id).toBe("autopack");
  });

  it("recommends drill mode when practice is low", () => {
    const result = computeKitChecklist({
      applicationId: "app-2",
      profileHeadline: "Platform Lead",
      profileName: "Test User",
      userEmail: "test@example.com",
      achievements: [
        { metrics: "Reduced MTTR by 20%" },
        { metrics: "Improved SLA to 99%" },
        { metrics: "Saved 12 hours per week" },
      ],
      autopack: {
        id: "autopack-1",
        cv_text: "CV content",
        cover_letter: "Cover letter content",
      },
      checklist: null,
      closingDate: null,
      submittedAt: null,
      nextActionDue: null,
      practiceQuestions: [
        { questionKey: "q1", questionText: "Question 1" },
        { questionKey: "q2", questionText: "Question 2" },
      ],
      practiceAnswers: {},
      starDrafts: [],
      outreachStage: "not_started",
      activities: [],
    });

    expect(result.nextActions.some((action) => action.id === "practice")).toBe(true);
  });

  it("prioritises closing date action when due soon", () => {
    const closingDate = new Date();
    closingDate.setDate(closingDate.getDate() + 2);
    const closingDateValue = closingDate.toISOString().slice(0, 10);

    const result = computeKitChecklist({
      applicationId: "app-3",
      profileHeadline: "Service Manager",
      profileName: "Test User",
      userEmail: "test@example.com",
      achievements: [{ metrics: "Improved SLA to 99%" }],
      autopack: {
        id: "autopack-2",
        cv_text: "CV content",
        cover_letter: "Cover letter content",
      },
      checklist: null,
      closingDate: closingDateValue,
      submittedAt: null,
      nextActionDue: null,
      practiceQuestions: [],
      practiceAnswers: {},
      starDrafts: [],
      outreachStage: "not_started",
      activities: [],
    });

    expect(result.nextActions.some((action) => action.id === "closing")).toBe(
      true
    );
  });

  it("recommends scheduling follow-up after submission", () => {
    const result = computeKitChecklist({
      applicationId: "app-4",
      profileHeadline: "Network Lead",
      profileName: "Test User",
      userEmail: "test@example.com",
      achievements: [{ metrics: "Reduced incidents by 15%" }],
      autopack: {
        id: "autopack-3",
        cv_text: "CV content",
        cover_letter: "Cover letter content",
      },
      checklist: null,
      closingDate: null,
      submittedAt: new Date().toISOString(),
      nextActionDue: null,
      status: "submitted",
      practiceQuestions: [],
      practiceAnswers: {},
      starDrafts: [],
      outreachStage: "not_started",
      activities: [],
    });

    expect(result.nextActions.some((action) => action.id === "followup")).toBe(true);
  });
});
