import { describe, expect, it } from "vitest";
import { buildOpsBillingHealth } from "@/lib/ops/ops-billing-health";

const now = new Date("2024-02-10T12:00:00.000Z");

describe("buildOpsBillingHealth", () => {
  it("aggregates portal/checkout/webhook counts across windows", () => {
    const incidents = [
      { at: "2024-02-10T11:00:00.000Z", eventName: "billing_portal_error", surface: "portal", code: "PORTAL_DOWN" },
      { at: "2024-02-10T09:00:00.000Z", eventName: "checkout_start_failed", surface: "checkout", code: "CHECKOUT_FAIL" },
      { at: "2024-02-05T09:00:00.000Z", eventName: "webhook_error", surface: "billing", code: "WEBHOOK_LATE" },
    ] as any;

    const summary = buildOpsBillingHealth(incidents, now);
    expect(summary.window24h.portalErrors).toBe(1);
    expect(summary.window24h.checkoutErrors).toBe(1);
    expect(summary.window24h.webhookErrors).toBe(0);
    expect(summary.window7d.webhookErrors).toBe(1);
    expect(summary.topCodes[0]).toEqual({ code: "portal_down", count: 1 });
  });
});
