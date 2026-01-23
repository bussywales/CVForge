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

describe("Ops alerts handled badges", () => {
  beforeEach(() => {
    logMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders handled badge for test event and logs curl copy", async () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
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
          handled: { at: "2024-01-01T00:05:00.000Z", source: "slack" },
        },
      ],
    });
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } } as any);
    render(<AlertsClient initial={initial} requestId="req_ack" />);
    fireEvent.click(screen.getByText(/Recent/i));
    fireEvent.click(screen.getByText(/Show/i));
    expect(screen.getByText(/Handled/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Copy ACK curl/i));
    await waitFor(() => expect(logMock).toHaveBeenCalledWith("ops_alerts_ack_curl_copy", null, "ops", { meta: { window: "15m" } }));
  });
});
