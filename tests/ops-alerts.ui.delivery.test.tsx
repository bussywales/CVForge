/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";
import { coerceOpsAlertsModel } from "@/lib/ops/alerts-model";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/alerts",
  useSearchParams: () => searchParamsValue,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

describe("Ops alerts delivery UI", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    logMock.mockReset();
  });

  it("shows delivery badges and copy actions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
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
