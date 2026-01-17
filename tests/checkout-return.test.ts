import { describe, expect, it } from "vitest";
import { parseCheckoutReturn } from "@/lib/billing/checkout-return";

describe("parseCheckoutReturn", () => {
  it("parses success with resume and plan", () => {
    const params = new URLSearchParams({
      success: "1",
      resume: "1",
      plan: "monthly_80",
      from: "streak_saver",
      mode: "subscription",
    });
    const state = parseCheckoutReturn(params);
    expect(state.status).toBe("success");
    expect(state.resume).toBe(true);
    expect(state.planKey).toBe("monthly_80");
    expect(state.from).toBe("streak_saver");
    expect(state.mode).toBe("subscription");
  });

  it("parses cancel and failed fallbacks", () => {
    const cancelState = parseCheckoutReturn({ cancel: "1", mode: "pack" });
    expect(cancelState.status).toBe("cancel");
    expect(cancelState.mode).toBe("pack");

    const failedState = parseCheckoutReturn({ status: "failed", reason: "network" });
    expect(failedState.status).toBe("failed");
    expect(failedState.reason).toBe("network");
  });
});
