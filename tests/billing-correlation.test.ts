import { describe, expect, it } from "vitest";
import { createBillingCorrelation } from "@/lib/billing/billing-correlation";

const timelineBase = [
  { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Checkout success", requestId: "req_checkout" },
] as any;

describe("createBillingCorrelation", () => {
  const now = new Date("2024-02-10T10:10:00.000Z");

  it("classifies waiting_webhook when only checkout exists", () => {
    const res = createBillingCorrelation({ timeline: timelineBase, ledger: [], now });
    expect(res.delay.state).toBe("waiting_webhook");
    expect(res.correlation.checkout.ok).toBe(true);
    expect(res.correlation.webhook.ok).toBe(false);
  });

  it("classifies waiting_ledger when webhook exists without credits", () => {
    const timeline = [
      ...timelineBase,
      { kind: "webhook_received", at: "2024-02-10T10:05:00.000Z", status: "info", label: "Webhook received", requestId: "req_webhook" },
    ] as any;
    const res = createBillingCorrelation({ timeline, ledger: [], now });
    expect(res.delay.state).toBe("waiting_ledger");
    expect(res.correlation.webhook.ok).toBe(true);
  });

  it("classifies ui_stale when credits applied earlier", () => {
    const timeline = [
      { kind: "credits_applied", at: "2024-02-10T09:59:00.000Z", status: "ok", label: "Credits applied" },
      ...timelineBase,
    ] as any;
    const res = createBillingCorrelation({ timeline, ledger: [], now });
    expect(res.delay.state).toBe("ui_stale");
  });

  it("returns none when checkout + webhook + credits present", () => {
    const timeline = [
      ...timelineBase,
      { kind: "webhook_received", at: "2024-02-10T10:02:00.000Z", status: "info", label: "Webhook received" },
      { kind: "credits_applied", at: "2024-02-10T10:03:00.000Z", status: "ok", label: "Credits applied" },
    ] as any;
    const res = createBillingCorrelation({ timeline, ledger: [], now });
    expect(res.delay.state).toBe("none");
  });

  it("classifies unknown when stale after long time without webhook/ledger", () => {
    const res = createBillingCorrelation({
      timeline: timelineBase,
      ledger: [],
      now: new Date("2024-02-10T10:40:00.000Z"),
    });
    expect(res.delay.state).toBe("unknown");
    expect(res.delay.confidence).toBe("med");
  });
});
