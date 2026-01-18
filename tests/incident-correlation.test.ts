import { describe, expect, it } from "vitest";
import { buildGroupKey, correlateIncidents, type IncidentRecord } from "@/lib/ops/incidents-shared";

const baseIncident = (overrides: Partial<IncidentRecord>): IncidentRecord => ({
  requestId: "req_base",
  at: new Date().toISOString(),
  surface: "checkout",
  code: "ERROR",
  message: "Failed checkout",
  userId: "user1",
  emailMasked: "u***@e***.com",
  context: {},
  eventName: "checkout_start_failed",
  flow: "flow_a",
  path: "/app/billing",
  returnTo: null,
  ...overrides,
});

describe("incident correlation and grouping", () => {
  it("builds stable group key with flow and message fingerprint", () => {
    const inc = baseIncident({ flow: "flow_a", message: "Failed checkout " });
    const key = buildGroupKey(inc);
    expect(key).toContain("checkout");
    expect(key).toContain("ERROR");
    expect(key).toContain("failed checkout");
    expect(key).toContain("flow_a");
  });

  it("correlates incidents within window and matching user/flow", () => {
    const target = baseIncident({});
    const relatedSameUser = baseIncident({
      requestId: "req_two",
      at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });
    const unrelated = baseIncident({
      requestId: "req_three",
      at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      userId: "other",
      flow: "other",
    });
    const results = correlateIncidents(target, [target, relatedSameUser, unrelated]);
    expect(results.map((r) => r.requestId)).toContain("req_two");
    expect(results.map((r) => r.requestId)).not.toContain("req_three");
  });
});
