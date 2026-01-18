import { describe, expect, it } from "vitest";
import { buildInterviewFocusSession } from "@/lib/interview-focus-session";

describe("interview focus session", () => {
  it("builds deterministic ordering and caps at 7", () => {
    const session = buildInterviewFocusSession({
      applicationId: "app-1",
      questions: Array.from({ length: 8 }).map((_, index) => ({
        key: `q-${index}`,
        question: `Question ${index}`,
        priority: index % 2 === 0 ? "high" : "medium",
        source: index % 2 === 0 ? "core" : "gap",
        index,
      })),
      answers: {},
    });

    expect(session.questions.length).toBeLessThanOrEqual(7);
    expect(session.questions[0].key).toBe("q-0");
    expect(session.questions[1].key).toBe("q-1");
  });
});
