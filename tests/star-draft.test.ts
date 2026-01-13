import { describe, expect, it } from "vitest";
import { buildStarDraft } from "../lib/star-draft";

describe("star draft", () => {
  it("builds deterministic STAR content", () => {
    const draft = buildStarDraft({
      jobDescription: "Lead incident response and vulnerability management.",
      achievementTitle: "Security Operations Lead",
    });

    expect(draft.requirement.toLowerCase()).toContain("incident");
    expect(draft.answer).toContain("Situation:");
    expect(draft.answer).toContain("Task:");
    expect(draft.answer).toContain("Action:");
    expect(draft.answer).toContain("Result:");
  });
});
