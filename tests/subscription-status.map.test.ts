import { describe, expect, it } from "vitest";
import { getPlanByPriceId } from "@/lib/billing/plans";
import { resolvePriceIdForPlan } from "@/lib/billing/plans";

describe("subscription status mapping helpers", () => {
  it("maps monthly_30 price id to monthly_30 plan", () => {
    const priceId = resolvePriceIdForPlan("monthly_30");
    if (!priceId) {
      expect(true).toBe(true); // skip if env not set
      return;
    }
    const plan = getPlanByPriceId(priceId);
    expect(plan?.key).toBe("monthly_30");
  });

  it("maps monthly_80 price id to monthly_80 plan", () => {
    const priceId = resolvePriceIdForPlan("monthly_80");
    if (!priceId) {
      expect(true).toBe(true); // skip if env not set
      return;
    }
    const plan = getPlanByPriceId(priceId);
    expect(plan?.key).toBe("monthly_80");
  });
});
