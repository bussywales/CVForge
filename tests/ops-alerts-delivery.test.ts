/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { recordAlertDelivery, getLatestDeliveries } from "@/lib/ops/ops-alerts-delivery";

const rows: any[] = [];

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      insert: (payload: any) => {
        rows.push(payload);
        return { data: payload };
      },
      select: () => ({
        in: (_field: string, values: any[]) => ({
          order: () => ({
            data: rows
              .filter((r) => values.includes(r.event_id))
              .sort((a, b) => new Date(b.at ?? b.created_at ?? 0).getTime() - new Date(a.at ?? a.created_at ?? 0).getTime()),
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe("ops alerts delivery helper", () => {
  it("records and summarizes latest delivery", async () => {
    rows.length = 0;
    await recordAlertDelivery({ eventId: "evt1", status: "sent", at: new Date("2024-01-01T00:00:00Z") });
    await recordAlertDelivery({ eventId: "evt1", status: "delivered", at: new Date("2024-01-01T00:05:00Z"), maskedReason: "ok" });
    const map = await getLatestDeliveries(["evt1"]);
    expect(map["evt1"].status).toBe("delivered");
  });
});
