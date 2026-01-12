import { describe, expect, it } from "vitest";
import {
  buildMetricSnippet,
  isMetricWithinLimit,
  metricTemplates,
} from "../lib/metrics-helper";

describe("metrics helper", () => {
  it("formats a metric snippet from template", () => {
    const template = metricTemplates.find(
      (entry) => entry.id === "percent-improvement"
    );
    expect(template).toBeTruthy();
    const text = buildMetricSnippet("percent-improvement", {
      metric: "incident response time",
      percent: "30",
      period: "6 months",
    });
    expect(text).toContain("incident response time");
    expect(text).toContain("30%");
    expect(isMetricWithinLimit(text)).toBe(true);
  });

  it("flags metrics over 120 characters", () => {
    const longValue = "x".repeat(200);
    const text = buildMetricSnippet("time-saved", {
      time: "200",
      unit: "hours",
      period: "month",
      activity: longValue,
    });
    expect(text.length).toBeGreaterThan(120);
    expect(isMetricWithinLimit(text)).toBe(false);
  });
});
