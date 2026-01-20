import { describe, expect, it } from "vitest";
import { buildOpsWebhookHealth } from "@/lib/ops/ops-webhook-health";

describe("buildOpsWebhookHealth", () => {
  const baseIncidents = [
    { at: "2024-02-10T10:00:00.000Z", eventName: "webhook_received", surface: "webhook", code: null, message: "" },
    { at: "2024-02-10T09:00:00.000Z", eventName: "webhook_error", surface: "webhook", code: "timeout", message: "error" },
    { at: "2024-02-05T09:00:00.000Z", eventName: "webhook_received", surface: "webhook", code: null, message: "" },
  ] as any;

  it("aggregates counts and top codes", () => {
    const res = buildOpsWebhookHealth(baseIncidents, new Date("2024-02-10T10:30:00.000Z"));
    expect(res.counts24h.ok).toBe(1);
    expect(res.counts24h.error).toBe(1);
    expect(res.counts7d.ok).toBe(2);
    expect(res.topCodes[0].code).toBe("timeout");
  });

  it("marks degraded when errors present", () => {
    const res = buildOpsWebhookHealth(baseIncidents, new Date("2024-02-10T10:30:00.000Z"));
    expect(res.status).toBe("degraded");
    expect(res.lastErrorCode).toBe("timeout");
  });

  it("returns healthy when only ok events", () => {
    const okOnly = [{ at: "2024-02-10T10:00:00.000Z", eventName: "webhook_received", surface: "webhook" }] as any;
    const res = buildOpsWebhookHealth(okOnly, new Date("2024-02-10T11:00:00.000Z"));
    expect(res.status).toBe("healthy");
    expect(res.lastOkAt).toBe("2024-02-10T10:00:00.000Z");
  });
});
