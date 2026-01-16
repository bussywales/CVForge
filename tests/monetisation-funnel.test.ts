import { describe, expect, it } from "vitest";
import { computeFunnel } from "@/lib/monetisation-funnel";

describe("monetisation funnel", () => {
  it("computes conversions", () => {
    const now = new Date().toISOString();
    const events = [
      { type: "monetisation.gate_shown", application_id: "a1", occurred_at: now, body: null },
      { type: "monetisation.billing_clicked", application_id: "a1", occurred_at: now, body: null },
      { type: "monetisation.checkout_started", application_id: "a1", occurred_at: now, body: null },
      { type: "monetisation.checkout_success", application_id: "a1", occurred_at: now, body: null },
    ];
    const summary = computeFunnel(events as any);
    expect(summary.last7.gate_shown).toBe(1);
    expect(summary.last7.checkout_success).toBe(1);
    expect(summary.last7.conversions["gate_shown->billing_clicked"]).toBe(100);
  });
});
