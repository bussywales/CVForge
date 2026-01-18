import { describe, expect, it } from "vitest";
import { buildSupportLink } from "@/lib/ops/support-links";

describe("support link builder", () => {
  it("includes ops params and destination", () => {
    const url = buildSupportLink({ kind: "billing_subscription_30", userId: "u1" });
    expect(url).toContain("from=ops_support");
    expect(url).toContain("support=1");
    expect(url).toContain("plan=monthly_30");
    expect(url).toContain("support=1");
  });
});
