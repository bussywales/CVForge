import { describe, expect, it } from "vitest";
import { scoreStarAnswer } from "@/lib/interview-practice";
import { rewriteStarAnswer } from "@/lib/interview-rewrite";

describe("rewriteStarAnswer", () => {
  it("adds STAR headings and metric placeholders when missing", () => {
    const answer = "Worked on incident response improvements for the team.";
    const scoring = scoreStarAnswer({
      answerText: answer,
      questionText: "Tell me about incident response improvements.",
      signals: ["Incident response"],
      gaps: ["Metrics"],
    });

    const rewrite = rewriteStarAnswer({
      answerText: answer,
      questionText: "Tell me about incident response improvements.",
      scoreBreakdown: scoring.breakdown,
      recommendations: scoring.recommendations,
      flags: scoring.flags,
      meta: { signals: ["incident"], gaps: ["metrics"] },
    });

    expect(rewrite.improvedText).toContain("Situation:");
    expect(rewrite.improvedText).toContain("Metrics:");
    expect(rewrite.improvedText).toMatch(/\[X\]/);
  });

  it("compresses overly long answers", () => {
    const answer = Array.from({ length: 50 })
      .map(
        () =>
          "I led the programme and improved SLA compliance by 12% across the estate."
      )
      .join(" ");
    const scoring = scoreStarAnswer({
      answerText: answer,
      questionText: "Describe a delivery success.",
      signals: ["Delivery"],
      gaps: [],
    });

    const rewrite = rewriteStarAnswer({
      answerText: answer,
      questionText: "Describe a delivery success.",
      scoreBreakdown: scoring.breakdown,
      recommendations: scoring.recommendations,
      flags: scoring.flags,
      meta: { signals: ["delivery"], gaps: [] },
    });

    expect(rewrite.improvedText.length).toBeLessThan(answer.length);
    expect(rewrite.improvedText).toContain("Action:");
  });

  it("preserves numbers and tools from the original answer", () => {
    const answer =
      "Used Splunk and Azure Monitor to reduce MTTR by 35% over 6 months.";
    const scoring = scoreStarAnswer({
      answerText: answer,
      questionText: "Tell me about monitoring improvements.",
      signals: ["SIEM"],
      gaps: [],
    });

    const rewrite = rewriteStarAnswer({
      answerText: answer,
      questionText: "Tell me about monitoring improvements.",
      scoreBreakdown: scoring.breakdown,
      recommendations: scoring.recommendations,
      flags: scoring.flags,
      meta: { signals: ["siem"], gaps: [] },
    });

    expect(rewrite.improvedText).toMatch(/Splunk/i);
    expect(rewrite.improvedText).toMatch(/35%/);
  });
});
