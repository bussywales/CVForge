/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }),
  }),
}));

const deliveries: any[] = [];
const recordAlertDelivery = vi.fn(async (payload: any) => {
  deliveries.push(payload);
});
vi.mock("@/lib/ops/ops-alerts-delivery", () => ({
  recordAlertDelivery,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("ops alerts notify receipts", () => {
  it("records sent and delivered receipts", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.com/webhook";
    process.env.OPS_ALERT_WEBHOOK_SECRET = "secret";
    deliveries.length = 0;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const mod = await import("@/lib/ops/ops-alerts-notify");
    await mod.notifyAlertTransitions({
      transitions: [{ key: "alert1", to: "firing" }],
      alerts: [{ key: "alert1", severity: "low", state: "firing", summary: "hi", actions: [], signals: {} } as any],
      previousStates: {},
      eventIdsByKey: { alert1: "evt1" },
      ackUrlByEventId: {},
    });
    expect(recordAlertDelivery).toHaveBeenCalled();
    expect(deliveries.some((d) => d.status === "sent")).toBeTruthy();
    expect(deliveries.some((d) => d.status === "delivered")).toBeTruthy();
  });

  it("records failure receipt", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.com/webhook";
    process.env.OPS_ALERT_WEBHOOK_SECRET = "secret";
    deliveries.length = 0;
    recordAlertDelivery.mockClear();
    fetchMock.mockRejectedValueOnce(new Error("fail"));
    const mod = await import("@/lib/ops/ops-alerts-notify");
    await mod.notifyAlertTransitions({
      transitions: [{ key: "alert1", to: "firing" }],
      alerts: [{ key: "alert1", severity: "low", state: "firing", summary: "hi", actions: [], signals: {} } as any],
      previousStates: {},
      eventIdsByKey: { alert1: "evt1" },
      ackUrlByEventId: {},
    });
    expect(recordAlertDelivery).toHaveBeenCalled();
    expect(deliveries.some((d) => d.status === "failed")).toBeTruthy();
  });
});
