import { describe, expect, it } from "vitest";
import { buildAuditCsv } from "@/lib/ops/audits-export";

describe("audits export helpers", () => {
  it("builds csv with masked fields", () => {
    const csv = buildAuditCsv([
      {
        id: "1",
        at: "2024-01-01T00:00:00.000Z",
        action: "test_action",
        actor: { email: "ops@example.com", role: "admin" },
        target: { userId: "user-1" },
        ref: "ref1",
        requestId: "req_123",
      },
    ]);
    expect(csv.split("\n")[0]).toContain("time,action,actorEmail");
    expect(csv).toContain("ops@example.com");
    expect(csv).toContain("req_123");
  });
});
