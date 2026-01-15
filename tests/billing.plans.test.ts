import { describe, expect, it } from "vitest";
import {
  getPlanByKey,
  getPlanByPriceId,
  resolvePriceIdForPlan,
} from "@/lib/billing/plans";

describe("subscription plans", () => {
  it("resolves price id from env", () => {
    process.env.STRIPE_SUB_MONTHLY_30_PRICE_ID = "price_monthly30";
    expect(resolvePriceIdForPlan("monthly_30")).toBe("price_monthly30");
  });

  it("maps price to plan", () => {
    process.env.STRIPE_SUB_MONTHLY_80_PRICE_ID = "price_monthly80";
    const plan = getPlanByPriceId("price_monthly80");
    expect(plan?.key).toBe("monthly_80");
  });

  it("returns null for unknown", () => {
    expect(getPlanByKey("unknown")).toBeNull();
  });
});
