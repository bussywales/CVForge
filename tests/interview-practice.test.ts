import { describe, expect, it } from "vitest";
import { scoreStarAnswer } from "@/lib/interview-practice";

describe("scoreStarAnswer", () => {
  it("flags missing metrics for a weak answer", () => {
    const answer = "Worked on a project to support the team. Focused on delivery.";
    const result = scoreStarAnswer({
      answerText: answer,
      questionText: "Tell me about a time you led delivery.",
      signals: ["Project delivery"],
      gaps: ["Metrics"],
    });

    expect(result.flags.missingMetrics).toBe(true);
    expect(result.totalScore).toBeLessThan(50);
  });

  it("scores higher when metrics and results are present", () => {
    const answer =
      "In 2023, I led a cross-functional delivery programme to modernise our service platform. " +
      "The goal was to reduce MTTR and improve SLA compliance while migrating critical workflows. " +
      "I designed the rollout plan, coordinated change approvals, and automated deployment checks. " +
      "As a result, MTTR fell by 35% and SLA compliance rose to 98% over two quarters, " +
      "while incident volumes dropped by 20% and release confidence improved.";

    const result = scoreStarAnswer({
      answerText: answer,
      questionText: "Tell me about a time you led incident response improvements.",
      signals: ["Incident response", "SLA"],
      gaps: [],
    });

    expect(result.flags.missingMetrics).toBe(false);
    expect(result.totalScore).toBeGreaterThan(60);
  });

  it("penalises placeholder content", () => {
    const answer = "TBD: add an example once confirmed.";
    const result = scoreStarAnswer({
      answerText: answer,
      questionText: "Describe your impact on risk reduction.",
      signals: ["Risk management"],
      gaps: ["Metrics"],
    });

    expect(result.flags.hasPlaceholders).toBe(true);
    expect(result.totalScore).toBeLessThan(30);
  });
});
