import { describe, expect, it } from "vitest";
import type { IncidentRecord } from "@/lib/ops/incidents-shared";
import { detectPortalSpike } from "@/lib/ops/portal-spike";

const baseIncident: IncidentRecord = {
  requestId: "req1",
  at: new Date().toISOString(),
  surface: "portal",
  code: "PORTAL_ERROR",
  message: "Portal failed",
  userId: "u1",
};

describe("portal spike detection", () => {
  it("detects spike when threshold met", () => {
    const incidents: IncidentRecord[] = [
      baseIncident,
      { ...baseIncident, requestId: "req2", userId: "u2" },
      { ...baseIncident, requestId: "req3", userId: "u3", code: "PORTAL_SESSION_MISSING" },
    ];
    const spike = detectPortalSpike(incidents, 3);
    expect(spike.spike).toBe(true);
    expect(spike.codes[0].count).toBeGreaterThan(0);
  });

  it("returns no spike when below threshold", () => {
    const spike = detectPortalSpike([baseIncident], 3);
    expect(spike.spike).toBe(false);
    expect(spike.total).toBe(1);
  });
});

