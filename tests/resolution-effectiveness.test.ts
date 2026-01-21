/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { computeDue, isOutcomeDue, LATER_WINDOW_MS } from "@/lib/ops/resolution-effectiveness";
import type { ResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";

describe("resolution effectiveness helper", () => {
  it("marks outcome due after 2h when unknown", () => {
    const now = new Date("2024-02-10T12:00:00.000Z");
    const outcome: ResolutionOutcome = {
      id: "o1",
      code: "PORTAL_RETRY_SUCCESS",
      createdAt: "2024-02-10T09:00:00.000Z",
      actor: null,
    };
    expect(isOutcomeDue(outcome, now)).toBe(true);
    const result = computeDue([outcome], now);
    expect(result.dueItems.length).toBe(1);
  });

  it("skips reviewed or deferred outcomes and builds insights", () => {
    const now = new Date("2024-02-10T12:00:00.000Z");
    const outcomes: ResolutionOutcome[] = [
      {
        id: "o1",
        code: "PORTAL_RETRY_SUCCESS",
        createdAt: "2024-02-10T08:00:00.000Z",
        actor: null,
        effectivenessState: "success",
      },
      {
        id: "o2",
        code: "WEBHOOK_DELAY_WAITED",
        createdAt: "2024-02-10T07:00:00.000Z",
        actor: null,
        requestId: "req_fail",
        effectivenessState: "fail",
        effectivenessReason: "still_blocked",
      },
      {
        id: "o3",
        code: "WEBHOOK_DELAY_WAITED",
        createdAt: "2024-02-10T07:30:00.000Z",
        actor: null,
        requestId: "req_fail",
        effectivenessState: "fail",
        effectivenessReason: "still_blocked",
      },
      {
        id: "o4",
        code: "OTHER",
        createdAt: "2024-02-10T10:30:00.000Z",
        actor: null,
        effectivenessState: "unknown",
        effectivenessDeferredUntil: new Date(now.getTime() + LATER_WINDOW_MS).toISOString(),
      },
    ];
    const result = computeDue(outcomes, now);
    expect(result.dueItems.length).toBe(0);
    expect(result.insights.topFailedCodes[0]).toEqual({ code: "WEBHOOK_DELAY_WAITED", count: 2 });
    expect(result.insights.topFailReasons[0]?.reason).toBe("still_blocked");
    expect(result.insights.repeatFailedRequestIds[0]?.requestId).toBe("req_fail");
  });
});
