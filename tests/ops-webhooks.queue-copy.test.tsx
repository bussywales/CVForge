/// <reference types="vitest/globals" />
import React from "react";
import { describe, expect, it, vi } from "vitest";
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

  it("calls watch API on click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as any);
    const items = [
      {
        id: "row_watch",
        requestId: null,
        at: "2024-02-10T10:00:00.000Z",
        code: "webhook_error",
        group: "stripe_webhook",
        actorMasked: null,
        userId: null,
        summary: "err",
        eventIdHash: "abc",
        groupKeyHash: "gkh",
        lastSeenAt: "2024-02-10T10:00:00.000Z",
        firstSeenAt: "2024-02-10T09:00:00.000Z",
        repeatCount: 3,
        correlation: {},
      },
    ];
    await act(async () => {
      root.render(<WebhooksClient initialItems={items as any} initialNextCursor={null} />);
    });
    const watchBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Watch");
    expect(watchBtn).toBeTruthy();
    await act(async () => {
      (watchBtn as HTMLButtonElement).click();
    });
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
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
