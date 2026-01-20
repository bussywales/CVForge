import { describe, expect, it } from "vitest";
import { buildPortalLink } from "@/lib/billing/portal-link";

describe("portal link", () => {
  it("builds manage link with returnTo", () => {
    const href = buildPortalLink({ flow: "manage", returnTo: "/app/billing?from=test" });
    expect(href).toContain("/api/billing/portal");
    expect(href).toContain("flow=manage");
    expect(href).toContain(encodeURIComponent("/app/billing?from=test"));
  });

  it("includes plan/from/support when provided", () => {
    const href = buildPortalLink({ flow: "manage", plan: "monthly_30", from: "ops_support", support: "1" });
    expect(href).toContain("plan=monthly_30");
    expect(href).toContain("from=ops_support");
    expect(href).toContain("support=1");
  });
});
