import { describe, expect, it } from "vitest";
import {
  CREDIT_PACKS,
  getPackByKey,
  resolvePriceIdForPack,
} from "@/lib/billing/packs";

describe("billing packs", () => {
  it("falls back to starter when no packKey", () => {
    const starter = CREDIT_PACKS[0];
    expect(getPackByKey(undefined)).toBeNull();
    expect(starter.key).toBe("starter");
  });

  it("maps price id from env", () => {
    process.env.STRIPE_PACK_STARTER_PRICE_ID = "price_starter";
    const priceId = resolvePriceIdForPack("starter");
    expect(priceId).toBe("price_starter");
  });
});
