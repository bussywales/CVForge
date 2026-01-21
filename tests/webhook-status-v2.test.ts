import { describe, expect, it } from "vitest";
import { buildWebhookStatusV2 } from "@/lib/webhook-status-v2";

const baseNow = new Date("2024-02-10T12:00:00.000Z");

describe("webhook status v2", () => {
  it("returns not_expected when no checkout is present", () => {
    const status = buildWebhookStatusV2({ timeline: [], webhookReceipt: null, now: baseNow });
    expect(status.state).toBe("not_expected");
    expect(status.reasonCode).toBe("NO_RECENT_CHECKOUT");
  });

  it("marks ok when credits applied even if no receipt", () => {
    const timeline = [
      { kind: "checkout_success", at: "2024-02-10T11:40:00.000Z", status: "ok", label: "Checkout success" },
      { kind: "credits_applied", at: "2024-02-10T11:50:00.000Z", status: "ok", label: "Credits applied" },
    ] as any;
    const status = buildWebhookStatusV2({ timeline, webhookReceipt: null, now: baseNow });
    expect(status.state).toBe("ok");
    expect(status.reasonCode).toBe("CREDIT_APPLIED");
  });

  it("marks ok when a receipt is seen", () => {
    const timeline = [
      { kind: "checkout_success", at: "2024-02-10T11:50:00.000Z", status: "ok", label: "Checkout success" },
      { kind: "webhook_received", at: "2024-02-10T11:52:00.000Z", status: "info", label: "Webhook received" },
    ] as any;
    const status = buildWebhookStatusV2({ timeline, webhookReceipt: null, now: baseNow });
    expect(status.state).toBe("ok");
    expect(status.reasonCode).toBe("RECEIPT_SEEN");
  });

  it("returns watching when within the expected window", () => {
    const timeline = [{ kind: "checkout_success", at: "2024-02-10T11:55:00.000Z", status: "ok", label: "Checkout success" }] as any;
    const status = buildWebhookStatusV2({ timeline, webhookReceipt: null, now: baseNow, expectedWindowMins: 20 });
    expect(status.state).toBe("watching");
    expect(status.reasonCode).toBe("EXPECTED_WAITING");
  });

  it("returns delayed when past expected window without credits or receipt", () => {
    const timeline = [{ kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Checkout success" }] as any;
    const status = buildWebhookStatusV2({ timeline, webhookReceipt: null, now: baseNow, expectedWindowMins: 30 });
    expect(status.state).toBe("delayed");
    expect(status.reasonCode).toContain("DELAY_BUCKET");
  });
});
