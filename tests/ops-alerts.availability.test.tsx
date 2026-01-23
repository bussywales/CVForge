/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";
import { coerceOpsAlertsModel } from "@/lib/ops/alerts-model";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

const fetchJsonSafeMock = vi.fn();
vi.mock("@/lib/http/safe-json", () => ({
  fetchJsonSafe: (...args: any[]) => fetchJsonSafeMock(...args),
}));

describe("Ops alerts availability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchJsonSafeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows calm empty state without unavailable when ok and empty alerts", () => {
    render(
      <AlertsClient
        initial={coerceOpsAlertsModel({
          ok: true,
          headline: "No alerts firing (last 15m)",
          alerts: [],
          recentEvents: [],
          webhookConfigured: true,
        })}
        requestId="req_ok"
      />
    );
    expect(screen.queryByText(/Alerts unavailable/i)).toBeNull();
    expect(screen.getByText(/No alerts firing/)).toBeTruthy();
    expect(screen.getByText(/Last checked:/i)).toBeTruthy();
  });

  it("shows unavailable when initial error", () => {
    render(<AlertsClient initial={coerceOpsAlertsModel(null)} initialError={{ message: "Bad", requestId: "req_err" }} requestId="req_err" />);
    expect(screen.getByText(/Alerts unavailable/i)).toBeTruthy();
  });

  it("updates last checked on refresh", async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    fetchJsonSafeMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [], headline: "Refreshed", webhookConfigured: true }),
    });
    render(
      <AlertsClient
        initial={coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [], headline: "Initial", webhookConfigured: true })}
        requestId="req_ok"
      />
    );
    expect(screen.getByText(/2024-01-01/)).toBeTruthy();
    vi.setSystemTime(new Date("2024-01-02T05:00:00Z"));
    fireEvent.click(screen.getByText(/Refresh/i));
    await waitFor(() => expect(screen.getByText(/2024-01-02/)).toBeTruthy());
  });

  it("shows webhook note when not configured and logs click", () => {
    const logSpy = require("@/lib/monetisation-client").logMonetisationClientEvent as ReturnType<typeof vi.fn>;
    render(
      <AlertsClient initial={coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [], webhookConfigured: false })} requestId="req_note" />
    );
    const link = screen.getByText(/Setup/i);
    fireEvent.click(link);
    expect(logSpy).toHaveBeenCalledWith("ops_alerts_webhook_setup_click", null, "ops", { meta: { destination: "ops_status" } });
  });
});
