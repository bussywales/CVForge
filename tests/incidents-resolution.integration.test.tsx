/// <reference types="vitest/globals" />
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IncidentsClient from "@/app/app/ops/incidents/incidents-client";
import type { IncidentRecord } from "@/lib/ops/incidents-shared";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

beforeEach(() => {
  logMock.mockReset();
});

function renderIncidents(incidents: IncidentRecord[]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<IncidentsClient incidents={incidents} />);
  });
  return container;
}

describe("IncidentsClient resolution integration", () => {
  it("shows resolution card for billing incidents", async () => {
    const incidents: IncidentRecord[] = [
      {
        at: new Date().toISOString(),
        requestId: "req_billing",
        surface: "billing",
        code: "webhook_error",
        message: "failed",
        userId: "user_b",
      },
    ];
    const container = renderIncidents(incidents);
    await act(async () => {});
    expect(container.querySelector('[data-testid="resolution-card"]')).toBeTruthy();
  });

  it("hides resolution card for non-billing incidents without request filter", async () => {
    const incidents: IncidentRecord[] = [
      {
        at: new Date().toISOString(),
        requestId: "req_other",
        surface: "outcomes",
        code: "outcome_fail",
        message: "other issue",
        userId: "user_o",
      },
    ];
    const container = renderIncidents(incidents);
    await act(async () => {});
    expect(container.querySelector('[data-testid="resolution-card"]')).toBeFalsy();
  });
});
