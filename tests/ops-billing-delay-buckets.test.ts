import { describe, expect, it } from "vitest";
import { buildBillingDelayBuckets } from "@/lib/ops/ops-billing-delay-buckets";

describe("buildBillingDelayBuckets", () => {
  const incidents = [
    { at: "2024-02-10T10:00:00.000Z", code: "waiting_webhook", message: "pending", surface: "billing" },
    { at: "2024-02-10T09:00:00.000Z", code: "waiting_ledger", message: "pending", surface: "billing" },
    { at: "2024-02-08T09:00:00.000Z", code: "ui_stale", message: "refresh", surface: "billing" },
  ] as any;

  it("aggregates 24h and 7d buckets", () => {
    const res = buildBillingDelayBuckets(incidents, new Date("2024-02-10T10:30:00.000Z"));
    expect(res.window24h.waiting_webhook).toBe(1);
    expect(res.window24h.waiting_ledger).toBe(1);
    expect(res.window24h.ui_stale).toBe(0);
    expect(res.window7d.ui_stale).toBe(1);
  });

  it("handles context delayState", () => {
    const res = buildBillingDelayBuckets(
      [{ at: "2024-02-10T10:00:00.000Z", context: { delayState: "unknown" }, surface: "billing" } as any],
      new Date("2024-02-10T11:00:00.000Z")
    );
    expect(res.window24h.unknown).toBe(1);
  });
});
