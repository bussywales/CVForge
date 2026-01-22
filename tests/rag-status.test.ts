import { describe, expect, it } from "vitest";
import { computeRagStatus } from "@/lib/ops/rag-status";

const baseMetrics = {
  portalErrors: 0,
  checkoutErrors: 0,
  webhookFailures: 0,
  webhookErrors: 0,
  rateLimits: 0,
};

const window = { minutes: 15, fromIso: "2024-02-10T09:45:00.000Z", toIso: "2024-02-10T10:00:00.000Z" };

describe("computeRagStatus", () => {
  it("returns green when under thresholds", () => {
    const rag = computeRagStatus(baseMetrics, window, new Date(window.toIso));
    expect(rag.overall).toBe("green");
    expect(rag.topIssues.length).toBe(0);
    expect(rag.window.minutes).toBe(15);
  });

  it("returns amber for elevated webhook failures", () => {
    const rag = computeRagStatus({ ...baseMetrics, webhookFailures: 3 }, window, new Date(window.toIso));
    expect(rag.overall).toBe("amber");
    expect(rag.topIssues[0].key).toBe("webhook_failures");
  });

  it("returns red for portal spike", () => {
    const rag = computeRagStatus({ ...baseMetrics, portalErrors: 12 }, window, new Date(window.toIso));
    expect(rag.overall).toBe("red");
    expect(rag.topIssues.some((i) => i.key === "portal_errors")).toBe(true);
  });

  it("returns red when webhook errors exceed threshold", () => {
    const rag = computeRagStatus({ ...baseMetrics, webhookErrors: 6 }, window, new Date(window.toIso));
    expect(rag.overall).toBe("red");
    expect(rag.topIssues[0].key).toBe("webhook_errors");
  });

  it("keeps amber for rate limits only", () => {
    const rag = computeRagStatus({ ...baseMetrics, rateLimits: 6 }, window, new Date(window.toIso));
    expect(rag.overall).toBe("amber");
    expect(rag.topIssues[0].key).toBe("rate_limits");
  });
});
