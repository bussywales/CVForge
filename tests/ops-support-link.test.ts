import { describe, expect, it, vi } from "vitest";
import { buildSupportLink } from "@/lib/ops/support-links";

describe("buildSupportLink", () => {
  it("builds billing compare link with flags", () => {
    const url = buildSupportLink({ kind: "billing_compare", userId: "u1" });
    expect(url).toContain("/app/billing");
    expect(url).toContain("from=ops_support");
    expect(url).toContain("support=1");
  });

  it("builds subscription link with plan", () => {
    const url = buildSupportLink({ kind: "billing_subscription_80", userId: "u1" });
    expect(url).toContain("plan=monthly_80");
  });

  it("builds application link with tab and anchor", () => {
    const url = buildSupportLink({
      kind: "application",
      userId: "u1",
      applicationId: "app123",
      tab: "activity",
      anchor: "outreach",
    });
    expect(url).toContain("/app/applications/app123");
    expect(url).toContain("tab=activity");
    expect(url).toContain("#outreach");
    expect(url).toContain("from=ops_support");
  });
});
