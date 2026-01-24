/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Ops alerts delivery UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    logMock.mockReset();
  });

  it("shows delivery badges and copy actions", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } } as any);
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [],
      recentEvents: [
        {
          id: "evt_d",
          key: "ops_alert_test",
          state: "firing",
          at: "2024-01-01T00:00:00.000Z",
          summary: "Test alert fired",
          isTest: true,
          severity: "low",
          signals: {},
          delivery: { status: "failed", maskedReason: "status_500", at: "2024-01-01T00:01:00.000Z" },
        },
      ],
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Recent/i));
    fireEvent.click(screen.getByText(/Show/i));
    expect(screen.getByText(/Failed/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Copy support snippet/i));
    expect(logMock).toHaveBeenCalledWith("ops_alerts_delivery_copy_ref", null, "ops", { meta: { window: "15m", type: "support" } });
  });
});
