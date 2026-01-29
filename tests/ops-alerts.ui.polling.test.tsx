/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("Ops alerts polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logMock.mockReset();
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls until the test event appears", async () => {
    let alertsCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_poll" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        alertsCalls += 1;
        const includeEvent = alertsCalls >= 3;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              alerts: [],
              recentEvents: includeEvent
                ? [
                    {
                      id: "evt_poll",
                      key: "ops_alert_test",
                      state: "firing",
                      at: "2024-01-01T00:00:00.000Z",
                      summary: "Test alert fired",
                      isTest: true,
                      severity: "low",
                      signals: {},
                    },
                  ]
                : [],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_poll" />);

    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Waiting for event to appear/i)).toBeTruthy());
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => expect(screen.getByText(/Test alert recorded/i)).toBeTruthy());
    expect(screen.queryByText(/Waiting for event to appear/i)).toBeNull();
    expect(logMock.mock.calls.some((call) => call[0] === "ops_alerts_test_poll_start")).toBe(true);
    expect(logMock.mock.calls.some((call) => call[0] === "ops_alerts_test_poll_found")).toBe(true);
    expect(logMock.mock.calls.some((call) => call[0] === "ops_alerts_test_poll_stop" && call[3]?.meta?.found === true)).toBe(true);
  });

  it("shows fallback hint when polling exhausts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_poll" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_poll" />);

    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Waiting for event to appear/i)).toBeTruthy());
    await vi.runAllTimersAsync();

    await waitFor(() => expect(screen.getByText(/Sent\\. If it doesn't appear, hit Refresh\\./i)).toBeTruthy());
    expect(logMock.mock.calls.some((call) => call[0] === "ops_alerts_test_poll_stop" && call[3]?.meta?.found === false)).toBe(true);
  });
});
