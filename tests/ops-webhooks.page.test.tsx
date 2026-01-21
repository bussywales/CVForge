/// <reference types="vitest/globals" />
import React from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import WebhooksClient from "@/app/app/ops/webhooks/webhooks-client";

describe("Ops webhooks page client", () => {
  it("renders table and actions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const items = [
      {
        id: "row_1",
        requestId: "req_1",
        at: "2024-02-10T10:00:00.000Z",
        code: "err_timeout",
        group: "stripe_webhook",
        actorMasked: "ops",
        userId: "user_1",
        summary: "err",
        eventIdHash: "abc",
        groupKeyHash: "gh1",
        lastSeenAt: "2024-02-10T10:00:00.000Z",
        repeatCount: 3,
        correlation: { checkoutSeen: true, webhookSeen: false, creditChanged: false },
      },
    ];
    await act(async () => {
      root.render(<WebhooksClient initialItems={items as any} initialNextCursor={null} />);
    });
    expect(container.textContent).toContain("Webhook failures");
    const exportBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Export JSON"));
    expect(exportBtn).toBeTruthy();
    const incidentsLink = Array.from(container.querySelectorAll("a")).find((el) => el.textContent?.includes("Open incidents"));
    expect(incidentsLink?.getAttribute("href")).toContain("/app/ops/incidents");
    expect(container.textContent).toContain("Repeats");
  });
});
