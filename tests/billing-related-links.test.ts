import { describe, expect, it } from "vitest";
import { buildRelatedIncidentsLink, buildRelatedAuditsLink } from "@/lib/billing/billing-related-links";

describe("billing related links", () => {
  it("builds incidents link with params", () => {
    const link = buildRelatedIncidentsLink({
      userId: "user-1",
      requestId: "req_1",
      isOps: true,
      fromSupportParams: null,
    });
    expect(link).toContain("userId=user-1");
    expect(link).toContain("requestId=req_1");
    expect(link?.includes("http")).toBe(false);
    expect(link?.includes("@")).toBe(false);
  });

  it("allows ops support flag for non-ops role", () => {
    const params = new URLSearchParams({ from: "ops_support", support: "1" });
    const link = buildRelatedIncidentsLink({ userId: "user-1", requestId: null, isOps: false, fromSupportParams: params });
    expect(link).toContain("surface=billing");
  });

  it("builds audits link only when requestId and ops", () => {
    const link = buildRelatedAuditsLink({ requestId: "req_1", isOps: true });
    expect(link).toContain("requestId=req_1");
    expect(buildRelatedAuditsLink({ requestId: null, isOps: true })).toBeNull();
  });
});
