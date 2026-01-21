/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { shouldSuppressPlaybook } from "@/lib/ops/playbook-suppression";
import type { IncidentGroup } from "@/lib/ops/incidents-shared";
import type { ResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";

const group: IncidentGroup = {
  key: "g1",
  surface: "billing",
  code: "portal_error",
  message: "err",
  flow: null,
  count: 1,
  firstSeen: "",
  lastSeen: "",
  sampleRequestIds: ["req_1"],
  incidents: [{ requestId: "req_1", at: new Date().toISOString(), surface: "billing", code: "portal_error", message: "err", userId: "user_1" }],
};

describe("billing playbook suppression with effectiveness", () => {
  it("suppresses when a success effectiveness exists", () => {
    const outcomes: ResolutionOutcome[] = [
      { id: "o1", code: "PORTAL_RETRY_SUCCESS", createdAt: new Date().toISOString(), actor: null, requestId: "req_1", userId: "user_1", effectivenessState: "success" },
    ];
    const result = shouldSuppressPlaybook({ group, outcomes, now: new Date() });
    expect(result.suppressed).toBe(true);
  });

  it("does not suppress when a failure is recorded", () => {
    const outcomes: ResolutionOutcome[] = [
      {
        id: "o1",
        code: "PORTAL_RETRY_SUCCESS",
        createdAt: new Date().toISOString(),
        actor: null,
        requestId: "req_1",
        userId: "user_1",
        effectivenessState: "fail",
      },
    ];
    const result = shouldSuppressPlaybook({ group, outcomes, now: new Date() });
    expect(result.suppressed).toBe(false);
    expect(result.failed).toBe(true);
  });
});
