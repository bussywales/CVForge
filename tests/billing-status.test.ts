import { describe, expect, it } from "vitest";
import { buildBillingStatus } from "@/lib/billing/billing-status";

const baseSettings = {
  user_id: "u1",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "active",
  subscription_plan: null,
  auto_topup_enabled: false,
  auto_topup_pack_key: null,
  auto_topup_threshold: 3,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("buildBillingStatus", () => {
  it("prefers portal error flag and request id", () => {
    const status = buildBillingStatus({
      settings: baseSettings as any,
      credits: 5,
      activity: [],
      searchParams: { portal_error: "1", req: "req_123", code: "STRIPE_PORTAL" },
      now: new Date("2024-02-01T00:00:00.000Z"),
    });

    expect(status.flags.portalError).toBe(true);
    expect(status.lastBillingEvent?.kind).toBe("portal_error");
    expect(status.lastBillingEvent?.requestId).toBe("req_123");
  });

  it("maps subscription status and picks newest ledger credit as last event", () => {
    const status = buildBillingStatus({
      settings: { ...baseSettings, subscription_status: "past_due" } as any,
      credits: 12,
      activity: [
        { id: "1", delta: 5, reason: "stripe.checkout", ref: "ref1", created_at: "2024-02-01T10:00:00.000Z" },
        { id: "2", delta: -1, reason: "autopack.generate", ref: "ref2", created_at: "2024-02-02T10:00:00.000Z" },
      ] as any,
      searchParams: {},
    });

    expect(status.subscriptionStatus).toBe("past_due");
    expect(status.lastBillingEvent?.kind).toBe("credit_grant");
    expect(status.lastBillingEvent?.requestId).toBe("ref1");
  });

  it("marks checkout success when return param present", () => {
    const status = buildBillingStatus({
      settings: baseSettings as any,
      credits: 0,
      activity: [],
      searchParams: { success: "1" },
    });

    expect(status.lastBillingEvent?.kind).toBe("checkout_success");
  });
});
