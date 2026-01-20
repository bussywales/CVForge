import { describe, expect, it } from "vitest";
import { buildBillingReconcileHint } from "@/lib/billing/billing-reconcile-hint";

describe("buildBillingReconcileHint", () => {
  it("shows hint when checkout success has no recent credits", () => {
    const hint = buildBillingReconcileHint({
      lastBillingEvent: { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z" },
      activity: [],
      now: new Date("2024-02-10T10:10:00.000Z"),
    });
    expect(hint.show).toBe(true);
  });

  it("hides hint when credits landed after checkout", () => {
    const hint = buildBillingReconcileHint({
      lastBillingEvent: { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z" },
      activity: [{ id: "1", delta: 5, reason: "stripe.checkout", ref: "ref1", created_at: "2024-02-10T10:05:00.000Z" }] as any,
      now: new Date("2024-02-10T10:06:00.000Z"),
    });
    expect(hint.show).toBe(false);
  });
});
