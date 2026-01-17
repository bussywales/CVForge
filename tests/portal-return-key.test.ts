import { describe, expect, it } from "vitest";
import { portalReturnKey, type PortalReturnState } from "@/lib/billing/portal-return";

const base: PortalReturnState = {
  portal: true,
  flow: "cancel",
  plan: "monthly_80",
  ts: null,
};

describe("portalReturnKey", () => {
  it("is stable for same flow/plan/weekKey", () => {
    const key1 = portalReturnKey(base, "2024-W12");
    const key2 = portalReturnKey({ ...base }, "2024-W12");
    expect(key1).toBe(key2);
  });

  it("changes when flow changes", () => {
    const key1 = portalReturnKey(base, "2024-W12");
    const key2 = portalReturnKey({ ...base, flow: "keep" }, "2024-W12");
    expect(key1).not.toBe(key2);
  });

  it("uses ts when present", () => {
    const key1 = portalReturnKey({ ...base, ts: "123" }, "2024-W12");
    const key2 = portalReturnKey({ ...base, ts: "456" }, "2024-W12");
    expect(key1).not.toBe(key2);
  });
});
