/// <reference types="vitest/globals" />
import React from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { buildOpsWebhookHealth } from "@/lib/ops/ops-webhook-health";
import WebhooksClient from "@/app/app/ops/webhooks/webhooks-client";

describe("ops webhooks queue", () => {
  it("shows empty state when no items", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<WebhooksClient initialItems={[]} initialNextCursor={null} />);
    });
    expect(container.textContent).toContain("No webhook failures in range");
  });

  it("counts failure spikes only when failures exist", () => {
    const incidents = [
      { at: "2024-02-10T10:00:00.000Z", code: "webhook_missing", surface: "webhook", eventName: "webhook_missing" },
      { at: "2024-02-10T09:00:00.000Z", code: "webhook_error_timeout", surface: "webhook", eventName: "webhook_error" },
    ] as any;
    const health = buildOpsWebhookHealth(incidents, new Date("2024-02-10T12:00:00.000Z"));
    expect(health.counts24h.error).toBe(1);
    expect(health.topCodes[0].code).toContain("webhook_error");
  });
});
