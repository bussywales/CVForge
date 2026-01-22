/// <reference types="vitest/globals" />
import React from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import WebhookBadge from "@/app/app/billing/webhook-badge";

describe("WebhookBadge copy", () => {
  it("shows neutral copy when credits exist without webhook", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <WebhookBadge
          status={{
            state: "ok",
            reasonCode: "CREDIT_APPLIED",
            message: "Credits applied",
            facts: { hasRecentCheckout: true, expectedWindowMins: 20 },
          }}
          supportSnippet="snippet"
          creditsAvailable={10}
          correlationConfidence={{ status: "healthy", confidence: "med", reason: "credits_applied" }}
        />
      );
    });
    expect(container.textContent).toContain("No recent webhook activity");
    expect(container.textContent).not.toContain("Copy support snippet");
  });

  it("shows CTA when delayed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <WebhookBadge
          status={{
            state: "delayed",
            reasonCode: "DELAY_BUCKET_WAITING_WEBHOOK",
            message: "Delayed",
            facts: { hasRecentCheckout: true, expectedWindowMins: 20 },
          }}
          supportSnippet="snippet"
          creditsAvailable={0}
          correlationConfidence={{ status: "delayed", confidence: "med", reason: "waiting_webhook" }}
        />
      );
    });
    expect(container.textContent).toContain("Copy support snippet");
  });
});
