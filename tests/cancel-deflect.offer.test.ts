import { describe, expect, it } from "vitest";
import { recommendCancelDeflect } from "@/lib/billing/cancel-deflect";

describe("cancel deflection offer", () => {
  it("recommends downgrade for monthly_80 expensive", () => {
    const reco = recommendCancelDeflect({ planKey: "monthly_80", reason: "expensive" });
    expect(reco.offerKey).toBe("downgrade");
    expect(reco.planTarget).toBe("monthly_30");
    expect(reco.flow).toBe("cancel_deflect");
  });

  it("recommends pause for low usage", () => {
    const reco = recommendCancelDeflect({ planKey: "monthly_30", reason: "low_usage" });
    expect(reco.offerKey).toBe("pause");
  });
});
