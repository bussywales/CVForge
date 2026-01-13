import { describe, expect, it } from "vitest";
import { orderPracticeQuestions, computePracticeStats } from "@/lib/practice-dashboard";

const questions = [
  { questionKey: "q1", questionText: "Question 1" },
  { questionKey: "q2", questionText: "Question 2" },
  { questionKey: "q3", questionText: "Question 3" },
];

describe("practice-dashboard helpers", () => {
  it("orders unscored first then lowest score", () => {
    const answers = {
      q1: { answer_text: "Draft", score: 70, rubric_json: null },
      q2: { answer_text: "", score: 0, rubric_json: null },
      q3: { answer_text: "Draft", score: 55, rubric_json: null },
    };

    const ordered = orderPracticeQuestions(questions, answers);
    expect(ordered[0].questionKey).toBe("q2");
    expect(ordered[1].questionKey).toBe("q3");
    expect(ordered[2].questionKey).toBe("q1");
  });

  it("computes average score across scored answers", () => {
    const answers = {
      q1: { answer_text: "Draft", score: 80, rubric_json: null },
      q2: { answer_text: "Draft", score: 60, rubric_json: null },
    };

    const stats = computePracticeStats(questions, answers);
    expect(stats.averageScore).toBe(70);
    expect(stats.scored).toBe(2);
  });
});
