/// <reference types="vitest/globals" />
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import BillingTracePanel from "@/app/app/billing/billing-trace-panel";
import { createBillingCorrelation } from "@/lib/billing/billing-correlation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("Billing trace correlation display", () => {
  it("shows unknown instead of missing when credits exist without upstream signals", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const timeline = [{ kind: "credits_applied", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Credits applied" }] as any;
    const correlation = createBillingCorrelation({ timeline, ledger: [], now: new Date("2024-02-10T12:00:00.000Z") });
    await act(async () => {
      root.render(
        <BillingTracePanel
          initialTimeline={timeline}
          initialDelay={{ state: "ok", message: "", nextSteps: [], severity: "low" } as any}
          initialWebhookHealth={{
            status: "unknown",
            lastOkAt: null,
            window: { hours24: { ok: 0, error: 0 }, days7: { ok: 0, error: 0 } },
          } as any}
          initialWebhookReceipt={{
            lastWebhookAt: null,
            lastWebhookType: null,
            lastWebhookRequestId: null,
            dedupe: { lastEventIdHash: null, dupCount24h: 0, distinctCount24h: 0 },
            errors24h: { webhook_error_count: 0, topCodes: [] },
          }}
          initialWebhookStatus={{
            state: "ok",
            reasonCode: "CREDIT_APPLIED",
            message: "Credits applied",
            facts: { hasRecentCheckout: false, expectedWindowMins: 20 },
          }}
          initialCorrelation={correlation}
          supportPath="/app/billing"
        />
      );
    });

    expect(container.textContent).toContain("unknown");
    expect(container.textContent).not.toContain("missing");
  });
});
