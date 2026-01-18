import { describe, expect, it } from "vitest";
import { buildInterviewFocus } from "@/lib/interview-focus";

describe("buildInterviewFocus", () => {
  const questions: Array<{
    key: string;
    question: string;
    priority: "high" | "medium" | "low";
    source: "gap" | "core" | "signal";
    index: number;
  }> = [
    { key: "q1", question: "Tell me about a time you led delivery.", priority: "high", source: "gap", index: 0 },
    { key: "q2", question: "How do you manage risk?", priority: "medium", source: "core", index: 1 },
    { key: "q3", question: "Describe a process you improved.", priority: "medium", source: "core", index: 2 },
    { key: "q4", question: "What motivates you?", priority: "low", source: "signal", index: 3 },
  ];

  it("ranks drafts first, then low scores, and keeps diversity", () => {
    const answers = {
      q2: { answer_text: "Some draft", score: 40 },
      q3: { answer_text: "Longer draft with score", score: 70 },
      q4: { answer_text: "Solid", score: 80 },
    };

    const plan = buildInterviewFocus({
      applicationId: "app-1",
      questions,
      answers,
    });

    expect(plan).toHaveLength(3);
    expect(plan[0].key).toBe("q1"); // no draft
    expect(plan[1].key).toBe("q2"); // low score next
    expect(new Set(plan.map((item) => item.source)).size).toBeGreaterThan(1);
    expect(plan[0].href).toContain("#answerpack-q-0");
  });
});
