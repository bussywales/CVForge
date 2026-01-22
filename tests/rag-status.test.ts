import { describe, expect, it } from "vitest";
import { computeRagStatus } from "@/lib/ops/rag-status";

const baseMetrics = {
  portalErrors: 0,
  checkoutErrors: 0,
  webhookFailures: 0,
  webhookRepeats: 0,
  rateLimit429s: 0,
};

describe("computeRagStatus", () => {
  it("returns green when under thresholds", () => {
    const rag = computeRagStatus(baseMetrics, new Date("2024-02-10T10:00:00.000Z"));
    expect(rag.overall).toBe("green");
    expect(rag.reasons.length).toBe(0);
    expect(rag.window).toBe("15m");
  });

  it("returns amber for elevated webhook failures", () => {
    const rag = computeRagStatus({ ...baseMetrics, webhookFailures: 3 }, new Date("2024-02-10T10:00:00.000Z"));
    expect(rag.overall).toBe("amber");
    expect(rag.reasons[0].area).toBe("webhook");
    expect(rag.reasons[0].level).toBe("amber");
  });

  it("returns red for portal spike or repeats", () => {
    const rag = computeRagStatus({ ...baseMetrics, portalErrors: 25 }, new Date("2024-02-10T10:00:00.000Z"));
    expect(rag.overall).toBe("red");
    expect(rag.reasons.some((r) => r.area === "portal" && r.level === "red")).toBe(true);
  });

  it("returns red when webhook repeats exceed threshold", () => {
    const rag = computeRagStatus({ ...baseMetrics, webhookRepeats: 3 }, new Date("2024-02-10T10:00:00.000Z"));
    expect(rag.overall).toBe("red");
    expect(rag.reasons[0].area).toBe("webhook");
  });

  it("returns amber for rate limits but escalates to red when high", () => {
    const amber = computeRagStatus({ ...baseMetrics, rateLimit429s: 12 }, new Date("2024-02-10T10:00:00.000Z"));
    expect(amber.overall).toBe("amber");
    const red = computeRagStatus({ ...baseMetrics, rateLimit429s: 55 }, new Date("2024-02-10T10:00:00.000Z"));
    expect(red.overall).toBe("red");
  });
});
