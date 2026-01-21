/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { buildWebhookReceipt } from "@/lib/webhook-receipts";

describe("webhook receipts helper", () => {
  it("computes dedupe counts and last webhook", () => {
    const now = new Date("2024-02-10T12:00:00.000Z");
    const events = [
      { type: "monetisation.webhook_received", occurred_at: "2024-02-10T10:00:00.000Z", body: JSON.stringify({ requestId: "req_1", eventId: "evt_1" }) },
      { type: "monetisation.webhook_received", occurred_at: "2024-02-10T10:05:00.000Z", body: JSON.stringify({ requestId: "req_1", eventId: "evt_1" }) },
      { type: "monetisation.webhook_error", occurred_at: "2024-02-10T09:00:00.000Z", body: JSON.stringify({ code: "err_timeout" }) },
    ];
    const receipt = buildWebhookReceipt({ events, now });
    expect(receipt.lastWebhookAt).toBe("2024-02-10T10:05:00.000Z");
    expect(receipt.dedupe.dupCount24h).toBe(1);
    expect(receipt.dedupe.distinctCount24h).toBe(1);
    expect(receipt.errors24h.webhook_error_count).toBe(1);
    expect(receipt.errors24h.topCodes[0]).toEqual({ code: "err_timeout", count: 1 });
  });
});
