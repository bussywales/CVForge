import { describe, expect, it } from "vitest";
import type { IncidentGroup, IncidentRecord } from "@/lib/ops/incidents-shared";
import { buildIncidentPlaybook } from "@/lib/ops/ops-incident-playbooks";

const baseIncident: IncidentRecord = {
  requestId: "req_123",
  at: new Date().toISOString(),
  surface: "portal",
  code: "PORTAL_FAIL",
  message: "Portal failed",
  userId: "user1",
  context: {},
};

function makeGroup(overrides: Partial<IncidentRecord>): IncidentGroup {
  const inc = { ...baseIncident, ...overrides };
  return {
    key: "k",
    surface: inc.surface,
    code: inc.code,
    message: inc.message,
    flow: inc.flow ?? null,
    count: 1,
    firstSeen: inc.at,
    lastSeen: inc.at,
    sampleRequestIds: [inc.requestId],
    incidents: [inc],
  };
}

describe("incident playbooks", () => {
  it("builds portal playbook with portal support link payload", () => {
    const group = makeGroup({ surface: "portal", code: "PORTAL_FAIL", context: { flow: "cancel" } });
    const pb = buildIncidentPlaybook(group);
    expect(pb?.id).toBe("stripe_portal_open");
    const supportAction = pb?.actions.find((a) => a.id === "support-link");
    expect(supportAction?.supportPayload?.portal).toBe("1");
    expect(supportAction?.supportPayload?.flow).toBe("cancel");
  });

  it("builds checkout playbook with pack/plan when provided", () => {
    const group = makeGroup({ surface: "checkout", code: "CHECKOUT_FAIL", message: "Checkout failed", context: { pack: "starter" } });
    const pb = buildIncidentPlaybook(group);
    expect(pb?.id).toBe("stripe_checkout_failed");
    const supportAction = pb?.actions.find((a) => a.id === "support-link");
    expect(supportAction?.supportPayload?.pack).toBe("starter");
    expect(supportAction?.supportPayload?.plan ?? null).toBeNull();
  });

  it("returns null for portal playbook when surface does not match", () => {
    const group = makeGroup({ surface: "outreach", code: "OTHER_ERR", message: "outreach failed" });
    const pb = buildIncidentPlaybook(group);
    expect(pb).toBeNull();
  });

  it("matches webhook playbook on webhook code", () => {
    const group = makeGroup({ surface: "other", code: "WEBHOOK_SIGNATURE_FAIL", message: "webhook error" });
    const pb = buildIncidentPlaybook(group);
    expect(pb?.id).toBe("stripe_webhook_failed");
  });

  it("matches credits playbook on credits message", () => {
    const group = makeGroup({ surface: "other", code: "ERR", message: "credits not applied" });
    const pb = buildIncidentPlaybook(group);
    expect(pb?.id).toBe("credits_mismatch");
  });
});
