import { describe, expect, it } from "vitest";
import { resolveBillingDeeplink } from "@/lib/billing/billing-deeplink";

describe("billing deep-link resolver", () => {
  it("maps pack to packs anchor", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ support: "1", pack: "starter" }));
    expect(intent).not.toBeNull();
    expect(intent?.kind).toBe("pack");
    expect(intent?.anchor).toBe("packs");
    expect(intent?.target).toBe("starter");
  });

  it("maps plan to subscription anchor", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ support: "1", plan: "monthly_80" }));
    expect(intent?.kind).toBe("plan");
    expect(intent?.anchor).toBe("subscription");
    expect(intent?.target).toBe("monthly_80");
  });

  it("prioritises portal/flow over plan/pack", () => {
    const intent = resolveBillingDeeplink(
      new URLSearchParams({ support: "1", portal: "1", flow: "cancel_save_offer", plan: "monthly_30", pack: "starter" })
    );
    expect(intent?.kind).toBe("portal_return");
    expect(intent?.anchor).toBe("portal-return");
  });

  it("still resolves when plan/pack provided without support flag", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ plan: "monthly_30" }));
    expect(intent?.kind).toBe("plan");
  });

  it("plan maps to subscription anchor", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ support: "1", plan: "monthly_80" }));
    expect(intent?.anchor).toBe("subscription");
  });

  it("pack maps to packs anchor", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ support: "1", pack: "starter" }));
    expect(intent?.anchor).toBe("packs");
  });

  it("portal missing but flow present still maps to portal-return", () => {
    const intent = resolveBillingDeeplink(new URLSearchParams({ support: "1", flow: "cancel" }));
    expect(intent?.anchor).toBe("portal-return");
  });
});
