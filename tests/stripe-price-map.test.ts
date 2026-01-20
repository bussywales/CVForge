import { describe, expect, it, vi } from "vitest";

describe("mapStripePriceToPlanKey", () => {
  it("maps known price ids from env", async () => {
    vi.stubEnv("STRIPE_SUB_MONTHLY_30_PRICE_ID", "price_30");
    vi.stubEnv("STRIPE_SUB_MONTHLY_80_PRICE_ID", "price_80");
    const { mapStripePriceToPlanKey } = await import("@/lib/ops/stripe-price-map");
    expect(mapStripePriceToPlanKey("price_30")).toBe("monthly_30");
    expect(mapStripePriceToPlanKey("price_80")).toBe("monthly_80");
  });

  it("returns unknown for unmapped ids", async () => {
    const { mapStripePriceToPlanKey } = await import("@/lib/ops/stripe-price-map");
    expect(mapStripePriceToPlanKey("price_unknown")).toBe("unknown");
    expect(mapStripePriceToPlanKey(null)).toBeNull();
  });
});
