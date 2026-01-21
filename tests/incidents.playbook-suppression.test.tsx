/// <reference types="vitest/globals" />
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Incidents playbook suppression", () => {
  afterEach(() => {
    logMock.mockReset();
  });

  it("renders suppressed card when outcome exists", async () => {
    const incidents: IncidentRecord[] = [
      {
        at: new Date().toISOString(),
        requestId: "req1",
        surface: "billing",
        code: "webhook_error",
        message: "err",
        userId: "user1",
      },
    ];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<IncidentsClient incidents={incidents} initialOutcomes={[{ code: "WEBHOOK_DELAY_WAITED", createdAt: new Date().toISOString(), actor: null, requestId: "req1", userId: "user1" }]} />);
    });
    await act(async () => {});
    expect(container.textContent).toContain("Resolved recently");
  });
});
