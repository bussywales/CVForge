import { describe, expect, it } from "vitest";
import { buildBillingTraceSummary } from "@/lib/ops/ops-billing-trace";

const now = new Date("2024-02-10T12:00:00.000Z");

describe("buildBillingTraceSummary", () => {
  it("aggregates checkout/webhook/delay counts and coverage", () => {
    const incidents = [
      { at: "2024-02-10T10:00:00.000Z", eventName: "checkout_success", code: null },
      { at: "2024-02-10T10:05:00.000Z", eventName: "webhook_received", code: null },
      { at: "2024-02-09T10:00:00.000Z", eventName: "checkout_success", code: null },
      { at: "2024-02-09T10:10:00.000Z", eventName: "webhook_error", code: "WEBHOOK_FAIL" },
      { at: "2024-02-09T10:15:00.000Z", eventName: "delayed_credit_detected", code: null },
    ] as any;

    const summary = buildBillingTraceSummary(incidents, now);
    expect(summary.window24h.checkoutSuccess).toBe(1);
    expect(summary.window24h.webhookReceived).toBe(1);
    expect(summary.window7d.webhookError).toBe(1);
    expect(summary.window7d.delayedCredit).toBe(1);
    expect(summary.coverage.ratio).toBe(100);
  });
});
