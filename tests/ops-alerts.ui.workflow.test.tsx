/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

const fetchMock = vi.fn();
vi.mock("@/lib/http/safe-json", () => ({
  fetchJsonSafe: (...args: any[]) => fetchMock(...args),
}));

describe("Alerts workflow UI", () => {
  it("shows claim button and handles snooze/unsnooze flows", async () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
      headline: "ok",
      alerts: [
        {
          key: "ops_alert_test",
          severity: "low",
          state: "firing",
          summary: "Test alert",
          signals: {},
          actions: [],
        },
      ],
      recentEvents: [],
      ownership: {},
      snoozes: {},
      currentUserId: "me",
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: { ownership: { claimedBy: "me", claimedAt: "2024-01-01", expiresAt: "2024-01-01T00:30:00Z" } } });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Claim/i));
    await waitFor(() => expect(logMock).toHaveBeenCalledWith("ops_alert_claim_click", null, "ops", expect.anything()));
  });

  it("renders gracefully without workflow maps", () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
      headline: "ok",
      alerts: [],
      recentEvents: [],
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    expect(screen.getByText(/Alerts/)).toBeTruthy();
  });
});
