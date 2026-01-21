/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { buildOutcomeEvent, listRecentOutcomes } from "@/lib/ops/ops-resolution-outcomes";

describe("ops resolution outcomes helper", () => {
  it("buildOutcomeEvent sanitises meta and trims note", () => {
    const { meta } = buildOutcomeEvent({
      code: "PORTAL_RETRY_SUCCESS",
      note: "a".repeat(300),
      requestId: "req_123",
      userId: "user_1",
      actorEmail: "ops@example.com",
      actorId: "ops_1",
    });
    expect(meta.note.length).toBeLessThanOrEqual(200);
    expect(meta.actor).toBeDefined();
    expect(meta.requestId).toBe("req_123");
    expect(meta.userId).toBe("user_1");
  });

  it("listRecentOutcomes returns newest first and truncates", async () => {
    const mockData = [
      { body: JSON.stringify({ code: "OTHER", note: "older", requestId: "req_old" }), occurred_at: "2023-01-01T00:00:00.000Z" },
      { body: JSON.stringify({ code: "PORTAL_RETRY_SUCCESS", note: "newer note", requestId: "req_new" }), occurred_at: "2024-02-10T10:00:00.000Z" },
    ];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: () => ({
                  like: () => ({ data: mockData, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as any;
    const outcomes = await listRecentOutcomes({ requestId: "req", limit: 2, client, now: new Date("2024-02-11T00:00:00.000Z") });
    expect(outcomes[0]?.code).toBe("PORTAL_RETRY_SUCCESS");
    expect(outcomes.length).toBe(2);
  });
});
