import { describe, expect, it } from "vitest";
import {
  buildPackProposal,
  extractTopTerms,
  redactPII,
} from "../lib/jd-learning";

describe("jd learning utils", () => {
  it("redacts emails, phones, and urls", () => {
    const input =
      "Contact jane.doe@example.com or +44 7700 900123 or visit https://example.com/jobs";
    const output = redactPII(input);
    expect(output).not.toContain("example.com");
    expect(output).not.toContain("@");
    expect(output).not.toContain("7700");
  });

  it("extracts top terms without PII", () => {
    const input =
      "Reach out at john@example.com. We need incident response and service delivery experience.";
    const terms = extractTopTerms(input);
    expect(terms.some((term) => term.includes("example"))).toBe(false);
    expect(terms.some((term) => term.includes("incident"))).toBe(true);
  });

  it("builds pack proposals with signal schema", () => {
    const proposal = buildPackProposal(["service delivery", "incident response"], "general");
    expect(proposal.signals.length).toBeGreaterThan(0);
    const signal = proposal.signals[0];
    expect(signal).toHaveProperty("aliases");
    expect(signal).toHaveProperty("gapSuggestions");
    expect(signal).toHaveProperty("metricSnippets");
  });
});
