import { describe, expect, it } from "vitest";
import { extractCvPreview, extractMetricsFromAction } from "../lib/cv-import";

describe("cv import heuristics", () => {
  it("detects name and headline from top lines", () => {
    const text = [
      "Jane Doe",
      "Senior Security Engineer",
      "jane.doe@example.com",
      "Experience",
      "• Led SIEM tuning to reduce false positives by 35%.",
    ].join("\n");

    const preview = extractCvPreview(text);
    expect(preview.profile.full_name).toBe("Jane Doe");
    expect(preview.profile.headline).toBe("Senior Security Engineer");
  });

  it("extracts metrics within 120 characters", () => {
    const metrics = extractMetricsFromAction(
      "Reduced incidents by 30% and improved MTTR to 2 hours across 3 sites."
    );
    expect(metrics.length).toBeLessThanOrEqual(120);
    expect(metrics).toContain("30%");
  });

  it("creates achievements from bullet-heavy text", () => {
    const text = [
      "Experience",
      "Network Engineer",
      "• Delivered firewall policy reviews and removed 20% of unused rules.",
      "• Reduced change-related incidents by 25% via CAB controls.",
    ].join("\n");

    const preview = extractCvPreview(text);
    expect(preview.achievements.length).toBeGreaterThan(0);
  });
});
