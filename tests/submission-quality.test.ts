import { describe, expect, it } from "vitest";
import {
  calculateKeywordCoverage,
  detectPlaceholders,
} from "../lib/submission-quality";

describe("submission quality", () => {
  it("calculates keyword coverage using JD terms", () => {
    const jd =
      "Lead Kubernetes cluster upgrades and Terraform pipeline improvements.";
    const evidence = "Delivered Kubernetes cluster upgrades in production.";
    const coverage = calculateKeywordCoverage(jd, evidence);
    expect(coverage.totalCount).toBeGreaterThan(0);
    expect(coverage.matchedCount).toBeGreaterThan(0);
    expect(coverage.coveragePct).toBeGreaterThan(0);
  });

  it("detects placeholder tokens", () => {
    const text = "INSERT metrics here <pending> [TBD]";
    expect(detectPlaceholders(text)).toBe(true);
  });

  it("ignores clean text", () => {
    const text = "Delivered incident response improvements and reduced MTTR.";
    expect(detectPlaceholders(text)).toBe(false);
  });
});
