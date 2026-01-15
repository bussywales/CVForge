import { describe, expect, it } from "vitest";
import {
  buildCopyAllText,
  computeAnswerPackReadiness,
} from "@/lib/answer-pack-ui";

describe("answer pack ui helpers", () => {
  it("computes readiness", () => {
    const items = [
      { question: "Q1", answer: "Answer one" },
      { question: "Q2", answer: "" },
    ];
    const result = computeAnswerPackReadiness(items);
    expect(result.readyCount).toBe(1);
    expect(result.total).toBe(2);
  });

  it("builds copy-all text", () => {
    const items = [
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
    ];
    const text = buildCopyAllText(items);
    expect(text).toContain("Q: Q1");
    expect(text).toContain("A: A2");
  });
});
