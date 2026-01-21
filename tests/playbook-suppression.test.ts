/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { shouldSuppressPlaybook } from "@/lib/ops/playbook-suppression";
import type { IncidentGroup } from "@/lib/ops/incidents-shared";
import type { ResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";

const baseGroup: IncidentGroup = {
  key: "g1",
  surface: "billing",
  code: "webhook_error",
  message: "error",
  flow: null,
  count: 1,
  firstSeen: "",
  lastSeen: "",
  sampleRequestIds: ["req_match"],
  incidents: [{ requestId: "req_match", at: new Date().toISOString(), surface: "billing", code: "webhook_error", message: "m", userId: "user_1" }],
};

describe("playbook suppression", () => {
  it("suppresses when outcome matches requestId within window", () => {
    const outcomes: ResolutionOutcome[] = [
      { code: "WEBHOOK_DELAY_WAITED", createdAt: new Date().toISOString(), actor: null, requestId: "req_match", userId: "user_1" },
    ];
    const res = shouldSuppressPlaybook({ group: baseGroup, outcomes, now: new Date() });
    expect(res.suppressed).toBe(true);
  });

  it("does not suppress when stale", () => {
    const outcomes: ResolutionOutcome[] = [
      { code: "WEBHOOK_DELAY_WAITED", createdAt: "2020-01-01T00:00:00.000Z", actor: null, requestId: "req_match", userId: "user_1" },
    ];
    const res = shouldSuppressPlaybook({ group: baseGroup, outcomes, now: new Date() });
    expect(res.suppressed).toBe(false);
  });
});
