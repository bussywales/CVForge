/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";
import { coerceOpsAlertsModel } from "@/lib/ops/alerts-model";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

describe("Ops alerts UI extras", () => {
  beforeEach(() => {
    logMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows test events when expanded", () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
      headline: "ok",
      alerts: [],
      recentEvents: [
        {
          id: "evt_test",
          key: "ops_alert_test",
          state: "firing",
          at: "2024-01-01T00:00:00.000Z",
          summary: "Test alert fired",
          isTest: true,
          severity: "low",
          signals: {},
        },
      ],
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Recent/i));
    const showButton = screen.getByText(/Test events/i).closest("div")?.querySelector("button") ?? screen.getByText(/Show/i);
    fireEvent.click(showButton as Element);
    expect(screen.getByText(/Test alert fired/i)).toBeTruthy();
  });

  it("marks handled without request id and shows badge", async () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
      headline: "ok",
      alerts: [
        {
          key: "ops_alert_rate_limit_pressure",
          severity: "medium",
          state: "firing",
          summary: "Rate limit pressure",
          signals: { signal: "rate_limits", surface: "billing", code: "RATE_LIMIT" },
          actions: [],
        },
      ],
      recentEvents: [],
      handled: {},
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, item: { createdAt: "2024-01-01T01:00:00.000Z" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Mark handled/i));
    await waitFor(() => expect(screen.getByText(/Handled/)).toBeTruthy());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.requestId).toBeNull();
    expect(payload.code).toBe("alert_handled");
  });
});
