/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Ops alerts ack UI", () => {
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

  it("acknowledges test event via token flow", async () => {
    let alertsCalls = 0;
    let handledAfterAck = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/ack-token")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, token: "tok_test" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/alerts/ack")) {
        handledAfterAck = true;
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_test", handled: true }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        alertsCalls += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
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
                  handled: handledAfterAck ? { at: "2024-01-01T00:05:00.000Z", source: "ui" } : null,
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
    fireEvent.click(screen.getByText(/Show/i));
    fireEvent.click(screen.getByText(/Acknowledge/i));
    await waitFor(() => expect(screen.getByText(/Acknowledged/i)).toBeTruthy());
    await waitFor(() => expect(alertsCalls).toBeGreaterThan(1));
    fireEvent.click(screen.getByText(/Copy ACK link/i));
    expect((navigator as any).clipboard.writeText).toHaveBeenCalled();
  });

  it("keeps acknowledged state when switching tabs after ack", async () => {
    let handledAfterAck = false;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/ack-token")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, token: "tok_test" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/alerts/ack")) {
        handledAfterAck = true;
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_test", handled: true }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              alerts: [
                {
                  key: "ops_alert_test",
                  severity: "low",
                  state: "firing",
                  summary: "Test alert fired",
                  signals: { eventId: "evt_test", signal: "alert_test", surface: "ops" },
                  actions: [],
                },
              ],
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
                  handled: handledAfterAck ? { at: "2024-01-01T00:05:00.000Z", source: "ui" } : null,
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
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [
        {
          key: "ops_alert_test",
          severity: "low",
          state: "firing",
          summary: "Test alert fired",
          signals: { eventId: "evt_test", signal: "alert_test", surface: "ops" },
          actions: [],
        },
      ],
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
    fireEvent.click(screen.getByText(/Show/i));
    fireEvent.click(screen.getByText(/Acknowledge/i));
    await waitFor(() => expect(screen.getByText(/Acknowledged/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Firing/i));
    await waitFor(() => {
      const ackButton = screen.getByText(/Acknowledged/i);
      expect(ackButton.closest("button")?.getAttribute("disabled")).not.toBeNull();
    });
  });

  it("rehydrates acknowledged state in firing tab from recent handled events", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
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
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [
        {
          key: "ops_alert_test",
          severity: "low",
          state: "firing",
          summary: "Test alert fired",
          signals: { eventId: "evt_test", signal: "alert_test", surface: "ops" },
          actions: [],
        },
      ],
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
          handled: { at: "2024-01-01T00:05:00.000Z", source: "ui" },
        },
      ],
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    await waitFor(() => {
      const ackButton = screen.getByText(/Acknowledged/i);
      expect(ackButton.closest("button")?.getAttribute("disabled")).not.toBeNull();
    });
  });

  it("shows error banner on non-json ack token response", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/ack-token")) {
        return Promise.resolve(new Response("nope", { status: 200, headers: { "content-type": "text/plain" } }));
      }
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [],
      recentEvents: [
        { id: "evt_test", key: "ops_alert_test", state: "firing", at: "2024-01-01T00:00:00.000Z", summary: "Test alert fired", isTest: true, signals: {} },
      ],
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Recent/i));
    fireEvent.click(screen.getByText(/Show/i));
    fireEvent.click(screen.getByText(/Acknowledge/i));
    await waitFor(() => expect(screen.getByText(/Unexpected response format|Unable to acknowledge alert/i)).toBeTruthy());
  });
});
