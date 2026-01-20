import { describe, expect, it } from "vitest";
import { filterIncidents } from "@/lib/ops/incidents-filters";
import type { IncidentRecord } from "@/lib/ops/incidents-shared";

const baseIncident: IncidentRecord = {
  requestId: "req1",
  at: new Date().toISOString(),
  surface: "billing",
  code: "ERR",
  message: "fail",
  userId: "u1",
};

describe("incidents filters", () => {
  it("filters by requestId when provided", () => {
    const incidents: IncidentRecord[] = [
      baseIncident,
      { ...baseIncident, requestId: "req2", userId: "u2", surface: "checkout" },
    ];
    const filtered = filterIncidents(incidents, {
      time: "24",
      surface: "all",
      code: "",
      flow: "",
      search: "",
      highImpact: false,
      requestId: "req2",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].requestId).toBe("req2");
  });
});
