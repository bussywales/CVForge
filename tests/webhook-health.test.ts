import { describe, expect, it } from "vitest";
import { computeWebhookHealth } from "@/lib/webhook-health";

describe("computeWebhookHealth", () => {
  const now = new Date("2024-02-10T10:30:00.000Z");

  it("returns healthy when recent ok exists", () => {
    const events = [
      { kind: "webhook_received", at: "2024-02-10T10:00:00.000Z" },
      { kind: "checkout_success", at: "2024-02-10T09:00:00.000Z" },
    ] as any;
    const res = computeWebhookHealth(events, new Date("2024-02-10T10:05:00.000Z"));
    expect(res.status).toBe("healthy");
    expect(res.lastOkAt).toBe("2024-02-10T10:00:00.000Z");
    expect(res.window.hours24.ok).toBe(2);
  });

  it("returns delayed when last ok is stale", () => {
    const events = [{ kind: "webhook_received", at: "2024-02-10T09:00:00.000Z" }] as any;
    const res = computeWebhookHealth(events, now);
    expect(res.status).toBe("delayed");
    expect(res.lagSeconds).toBeGreaterThan(15 * 60);
  });

  it("prefers degraded when recent error exists", () => {
    const events = [
      { kind: "webhook_received", at: "2024-02-10T09:00:00.000Z" },
      { kind: "webhook_error", at: "2024-02-10T09:45:00.000Z", code: "timeout" },
    ] as any;
    const res = computeWebhookHealth(events, now);
    expect(res.status).toBe("degraded");
    expect(res.lastErrorCode).toBe("timeout");
  });

  it("returns unknown when no data exists", () => {
    const res = computeWebhookHealth([], now);
    expect(res.status).toBe("unknown");
    expect(res.lastOkAt).toBeNull();
  });
});
