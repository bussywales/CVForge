import { describe, expect, it } from "vitest";
import { buildSupportBundleFromAudit, buildSupportBundleFromIncident } from "@/lib/ops/support-bundle";

describe("support bundle", () => {
  it("masks emails and picks meta from audit", () => {
    const bundle = buildSupportBundleFromAudit({
      id: "1",
      at: "2024-01-01T00:00:00.000Z",
      action: "billing_portal",
      actor: { email: "ops@example.com", id: "actor1" },
      target: { userId: "user1" },
      requestId: "req_1",
      meta: { code: "PORTAL_FAIL", email: "secret@example.com", flow: "cancel" },
    });
    expect(bundle.actor).toBe("o***s@example.com");
    expect(bundle.meta.email).not.toBe("secret@example.com");
    expect(bundle.meta.flow).toBe("cancel");
    expect(bundle.nextAction?.toLowerCase()).toContain("billing");
    expect(bundle.snippet).toContain("req_1");
  });

  it("builds incident bundle with masked actor and next action", () => {
    const bundle = buildSupportBundleFromIncident({
      requestId: "req_inc",
      at: "2024-01-01T00:00:00.000Z",
      surface: "billing",
      code: "BILL_FAIL",
      message: "Billing failed",
      userId: "user2",
      emailMasked: "t***t@example.com",
      context: { flow: "portal", token: "Bearer abc" },
      flow: "portal",
      path: "/app/billing",
      returnTo: null,
    });
    expect(bundle.actor).toBe("t***t@example.com");
    expect(bundle.meta.token).toBe("[masked_token]");
    expect(bundle.nextAction?.toLowerCase()).toContain("billing");
    expect(bundle.snippet).toContain("req_inc");
  });
});
