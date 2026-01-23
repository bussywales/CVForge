/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { coerceOpsAlertsModel } from "@/lib/ops/alerts-model";

describe("coerceOpsAlertsModel", () => {
  it("returns defaults for null", () => {
    const model = coerceOpsAlertsModel(null);
    expect(model.alerts).toEqual([]);
    expect(model.recentEvents).toEqual([]);
    expect(model.ok).toBe(false);
  });

  it("normalises arrays when missing", () => {
    const model = coerceOpsAlertsModel({ ok: true });
    expect(model.alerts).toEqual([]);
    expect(model.recentEvents).toEqual([]);
    expect(model.ok).toBe(true);
  });

  it("preserves fields", () => {
    const model = coerceOpsAlertsModel({ headline: "Hi", requestId: "req1", webhookConfigured: true, alerts: [{ state: "firing", severity: "high" }] });
    expect(model.headline).toBe("Hi");
    expect(model.requestId).toBe("req1");
    expect(model.webhookConfigured).toBe(true);
    expect(model.alerts.length).toBe(1);
    expect(model.firingCount).toBe(1);
  });
});
