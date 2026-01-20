import { describe, expect, it } from "vitest";
import { parsePortalError } from "@/lib/billing/portal-error";

describe("billing portal banner helper", () => {
  it("parses portal error params and builds retry href", () => {
    const state = parsePortalError({ portal_error: "1", req: "req_789", code: "STRIPE_PORTAL", flow: "cancel", from: "ops_support" });
    expect(state.show).toBe(true);
    expect(state.requestId).toBe("req_789");
    expect(state.code).toBe("STRIPE_PORTAL");
    expect(state.retryHref).toContain("flow=cancel");
    expect(state.retryHref).toContain("from=ops_support");
    expect(state.retryHref).toContain("mode=navigation");
  });

  it("hides banner when portal_error flag is absent", () => {
    const state = parsePortalError({ portal_error: "0" });
    expect(state.show).toBe(false);
    expect(state.requestId).toBeNull();
  });
});
