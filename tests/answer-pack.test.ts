import { describe, expect, it } from "vitest";
import { buildAnswer } from "@/lib/interview/answer-pack";

describe("buildAnswer", () => {
  it("includes metrics and short90 is shorter", () => {
    const starDraft = {
      id: "star-1",
      gap_key: "security_risk",
      title: "Security risk reduction",
      situation: "I was leading a security hardening programme.",
      task: "My task was to reduce critical risk exposure.",
      action: "Implemented firewall policy reviews and automated checks.",
      result: "Reduced critical findings by 35% and improved SLA compliance.",
      quality_hint: "Strong",
      updated_at: new Date().toISOString(),
    };

    const standard = buildAnswer({
      type: "security_risk",
      starDraft,
      short90: false,
    });
    const short90 = buildAnswer({
      type: "security_risk",
      starDraft,
      short90: true,
    });

    expect(standard.answerText).toMatch(/35%/);
    expect(short90.answerText).toMatch(/35%/);
    expect(short90.answerText.length).toBeLessThan(standard.answerText.length);
    expect(short90.answerText).not.toMatch(/\bTBD\b|\[.+]/i);
  });
});
