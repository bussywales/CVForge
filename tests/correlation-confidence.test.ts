import { describe, expect, it } from "vitest";
import { buildCorrelationConfidence } from "@/lib/webhook-status-v2";

describe("correlation confidence", () => {
  it("treats credits without upstream as healthy", () => {
    const timeline = [{ kind: "credits_applied", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "credits" }] as any;
    const res = buildCorrelationConfidence({ timeline, webhookReceipt: null, delay: null, now: new Date("2024-02-10T11:00:00.000Z") });
    expect(res.confidence).toBe("healthy");
  });

  it("flags delay state as delayed", () => {
    const timeline = [{ kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "checkout" }] as any;
    const res = buildCorrelationConfidence({
      timeline,
      webhookReceipt: null,
      delay: { state: "waiting_webhook", confidence: "high", explanation: "" } as any,
      now: new Date("2024-02-10T11:00:00.000Z"),
    });
    expect(res.confidence).toBe("delayed");
  });

  it("marks webhook errors as failed", () => {
    const timeline = [{ kind: "webhook_error", at: "2024-02-10T10:05:00.000Z", status: "error", label: "error" }] as any;
    const res = buildCorrelationConfidence({ timeline, webhookReceipt: { errors24h: { webhook_error_count: 1, topCodes: [] } } as any, delay: null });
    expect(res.confidence).toBe("failed");
  });
});
