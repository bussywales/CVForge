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

  it("builds application link with focus and tab", () => {
    const url = buildSupportLink({
      kind: "application_outreach",
      userId: "u1",
      appId: "app123",
    });
    expect(url).toContain("/app/applications/app123");
    expect(url).toContain("tab=activity");
    expect(url).toContain("focus=outreach");
    expect(url).toContain("from=ops_support");
  });

  it("builds interview link without app id", () => {
    const url = buildSupportLink({ kind: "interview", userId: "u1" });
    expect(url).toContain("/app/interview");
    expect(url).toContain("focus=interview-focus-session");
  });
});
