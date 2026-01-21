/// <reference types="vitest/globals" />
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingTriageCard from "@/app/app/ops/users/[id]/billing-triage-card";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

const snapshot = {
  ok: true as const,
  requestId: "req_triage",
  user: { id: "user_triage", emailMasked: "masked@example.com" },
  local: {
    subscriptionStatus: "active",
    creditsAvailable: 10,
    lastBillingEvent: { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", requestId: "req_triage" },
  },
  timeline: [
    {
      kind: "checkout_success",
      at: "2024-02-10T10:00:00.000Z",
      status: "ok",
      requestId: "req_triage",
      label: "Checkout success",
    },
  ],
  webhookHealth: {
    status: "healthy",
    lastOkAt: "2024-02-10T10:00:00.000Z",
    window: { hours: { ok: 1, error: 0 }, days: { ok: 1, error: 0 } },
    lagSeconds: 0,
  },
  delayState: { state: "ok", message: "", nextSteps: [], severity: "low" },
  stripe: {
    customerIdMasked: "cus_masked",
    hasCustomer: true,
    hasSubscription: true,
    subscriptionStatus: "active" as const,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2024-02-20T10:00:00.000Z",
    priceKey: "monthly_30",
    latestInvoiceStatus: "paid",
    lastPaymentErrorCode: null,
  },
};

describe("Billing triage resolution integration", () => {
  beforeEach(() => {
    logMock.mockReset();
    (global as any).fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(snapshot),
    });
    (global.navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders resolution card under billing triage", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<BillingTriageCard userId="user_triage" />);
    });
    await act(async () => {});
    expect(container.querySelector('[data-testid="resolution-card"]')).toBeTruthy();
  });
});
