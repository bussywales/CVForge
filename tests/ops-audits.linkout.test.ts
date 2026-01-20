import { describe, expect, it } from "vitest";
import { buildIncidentsLink, buildAuditsLink } from "@/lib/ops/incidents-shared";

describe("ops linkouts", () => {
  it("builds incidents link from requestId", () => {
    const link = buildIncidentsLink("req_123");
    expect(link).toContain("requestId=req_123");
    expect(link).toContain("from=ops_audits");
  });

  it("builds audits link from incidents", () => {
    const link = buildAuditsLink("req_456");
    expect(link).toContain("q=req_456");
    expect(link).toContain("from=ops_incidents");
  });
});
