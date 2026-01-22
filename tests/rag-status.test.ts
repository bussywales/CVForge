import { beforeEach, describe, expect, it, vi } from "vitest";

let activities: any[] = [];
let webhookFailures: any[] = [];
let rateLimitEvents: any[] = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        gte: () => ({
          or: () => ({
            order: () => ({
              limit: async () => ({ data: activities, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/ops/webhook-failures", () => ({
  listWebhookFailures: async () => ({ items: webhookFailures, nextCursor: null }),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitLog: () => rateLimitEvents,
}));

describe("rag status v2", () => {
  beforeEach(() => {
    activities = [];
    webhookFailures = [];
    rateLimitEvents = [];
  });

  it("builds red status when webhook failures spike and returns trend buckets", async () => {
    const now = new Date("2024-02-10T10:00:00.000Z");
    webhookFailures = Array.from({ length: 6 }).map((_, idx) => ({
      id: `wf-${idx}`,
      requestId: `req-${idx}`,
      at: new Date(now.getTime() - idx * 2 * 60 * 1000).toISOString(),
      code: "timeout",
      group: "stripe_webhook",
      actorMasked: null,
      userId: null,
      summary: "failure",
      eventIdHash: `hash-${idx}`,
      groupKeyHash: `g-${idx}`,
      lastSeenAt: null,
      firstSeenAt: null,
      repeatCount: 1,
      correlation: {},
    }));
    const { buildRagStatus } = await import("@/lib/ops/rag-status");
    const rag = await buildRagStatus({ now, windowMinutes: 15, trendHours: 24 });
    expect(rag.status).toBe("red");
    expect(rag.topIssues[0].key).toBe("webhook_failures");
    expect(rag.signals.find((s) => s.key === "webhook_failures")?.count).toBe(6);
    expect(rag.trend.buckets.length).toBe(96);
    expect(rag.rulesVersion).toBe("rag_v2_15m_trend");
  });

  it("marks improving direction when past buckets were worse", async () => {
    const now = new Date("2024-02-10T10:00:00.000Z");
    // Add portal errors in the 1-2h window, none recently.
    activities = Array.from({ length: 6 }).map((_, idx) => ({
      type: "monetisation.billing_portal_error",
      body: JSON.stringify({ code: "portal_error" }),
      occurred_at: new Date(now.getTime() - 90 * 60 * 1000 - idx * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 90 * 60 * 1000 - idx * 60 * 1000).toISOString(),
    }));
    const { buildRagStatus } = await import("@/lib/ops/rag-status");
    const rag = await buildRagStatus({ now, windowMinutes: 15, trendHours: 24 });
    expect(rag.status).toBe("green");
    expect(rag.trend.direction).toBe("improving");
    expect(rag.topIssues.length).toBe(0);
    expect(rag.trend.buckets.slice(-1)[0]?.green).toBe(1);
  });
});
