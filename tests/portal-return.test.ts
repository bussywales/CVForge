import { describe, expect, it } from "vitest";
import { parsePortalReturn, portalDismissKey } from "@/lib/billing/portal-return";

describe("portal return helper", () => {
  it("parses portal params", () => {
    const params = new URLSearchParams({
      portal: "1",
      flow: "cancel",
      plan: "monthly_80",
    });
    const state = parsePortalReturn(params);
    expect(state.portal).toBe(true);
    expect(state.flow).toBe("cancel");
    expect(state.plan).toBe("monthly_80");
  });

  it("builds dismiss key", () => {
    expect(portalDismissKey("2024-W10")).toBe("portal_return_2024-W10");
  });
});
