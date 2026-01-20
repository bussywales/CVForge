import { describe, expect, it } from "vitest";
import { buildPortalLink } from "@/lib/billing/portal-link";

describe("portal link", () => {
  it("builds manage link with returnTo", () => {
    const href = buildPortalLink({ flow: "manage", returnTo: "/app/billing?from=test" });
    expect(href).toContain("/api/billing/portal");
    expect(href).toContain("flow=manage");
    expect(href).toContain(encodeURIComponent("/app/billing?from=test"));
  });
});

