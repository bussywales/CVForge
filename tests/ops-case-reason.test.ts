/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { buildCaseReasonSource, resolveCaseReason } from "@/lib/ops/ops-case-reason";

describe("ops case reason", () => {
  it("uses precedence to select reason", () => {
    const now = new Date("2024-01-01T02:00:00.000Z");
    const sources = [
      buildCaseReasonSource({
        code: "MANUAL",
        primarySource: "ops_case_notes",
        count: 1,
        lastSeenAt: "2024-01-01T01:00:00.000Z",
        windowLabel: "24h",
      }),
      buildCaseReasonSource({
        code: "WEBHOOK_FAILURE",
        primarySource: "application_activities",
        count: 2,
        lastSeenAt: "2024-01-01T01:30:00.000Z",
        windowLabel: "24h",
      }),
      buildCaseReasonSource({
        code: "TRAINING",
        primarySource: "ops_training_scenarios",
        count: 1,
        lastSeenAt: "2024-01-01T01:45:00.000Z",
        windowLabel: "24h",
      }),
    ];
    const result = resolveCaseReason({ sources, windowFromIso: "2024-01-01T00:00:00.000Z", windowLabel: "24h", now });
    expect(result.reason.code).toBe("WEBHOOK_FAILURE");
  });

  it("falls back to unknown when no sources in window", () => {
    const now = new Date("2024-01-02T00:00:00.000Z");
    const sources = [
      buildCaseReasonSource({
        code: "MANUAL",
        primarySource: "ops_case_notes",
        count: 1,
        lastSeenAt: "2024-01-01T00:00:00.000Z",
        windowLabel: "15m",
      }),
    ];
    const result = resolveCaseReason({
      sources,
      windowFromIso: "2024-01-01T23:30:00.000Z",
      windowLabel: "15m",
      now,
    });
    expect(result.reason.code).toBe("UNKNOWN");
  });
});
