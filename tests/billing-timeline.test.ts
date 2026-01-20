import { describe, expect, it } from "vitest";
import { buildBillingTimeline } from "@/lib/billing/billing-timeline";

describe("billing timeline helper", () => {
  it("builds ordered timeline from monetisation and ledger entries", () => {
    const events = [
      { type: "monetisation.billing_portal_error", occurred_at: "2024-02-10T10:00:00.000Z", body: JSON.stringify({ requestId: "req_portal" }) },
      { type: "monetisation.checkout_success", occurred_at: "2024-02-10T09:00:00.000Z", body: JSON.stringify({ requestId: "req_checkout" }) },
    ];
    const ledger = [
      { id: "1", delta: 10, reason: "stripe.checkout", ref: "ref_checkout", created_at: "2024-02-10T09:05:00.000Z" },
    ] as any;

    const timeline = buildBillingTimeline({ events: events as any, ledger, limit: 5 });
    expect(timeline[0].kind).toBe("portal_error");
    expect(timeline[0].requestId).toBe("req_portal");
    expect(timeline[1].kind).toBe("credits_applied");
    expect(timeline[1].requestId).toBe("ref_checkout");
  });

  it("masks unknown events and caps length", () => {
    const events = new Array(10).fill(null).map((_, idx) => ({
      type: "monetisation.checkout_started",
      occurred_at: `2024-02-10T09:${idx.toString().padStart(2, "0")}:00.000Z`,
      body: null,
    }));
    const timeline = buildBillingTimeline({ events: events as any, ledger: [], limit: 5 });
    expect(timeline.length).toBe(5);
    expect(timeline.every((entry) => entry.kind === "checkout_started")).toBe(true);
  });
});
