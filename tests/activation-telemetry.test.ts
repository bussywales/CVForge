import { describe, expect, it } from "vitest";
import { buildActivationMeta } from "@/lib/activation-telemetry";

describe("activation telemetry meta", () => {
  it("builds stable meta without URLs", () => {
    const meta = buildActivationMeta({ stepKey: "first_outreach", ctaKey: "primary", appId: "app1" });
    expect(meta).toEqual({
      stepKey: "first_outreach",
      ctaKey: "primary",
      source: "dashboard",
      mode: "navigation",
      appId: "app1",
      requestId: null,
    });
  });
});
