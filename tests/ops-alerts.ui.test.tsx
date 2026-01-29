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

describe("Ops alerts UI extras", () => {
  beforeEach(() => {
    logMock.mockReset();
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows test events when expanded", () => {
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

  it("fetches latest alerts when switching to Recent", async () => {
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
                  id: "evt_new",
                  key: "ops_alert_test",
                  state: "firing",
                  at: "2024-01-01T00:00:00.000Z",
                  summary: "New test event",
                  isTest: true,
                  severity: "low",
                  signals: {},
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
    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Recent/i));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/ops/alerts"))).toBe(true));
    const showButton = screen.getByText(/Test events/i).closest("div")?.querySelector("button") ?? screen.getByText(/Show/i);
    fireEvent.click(showButton as Element);
    await waitFor(() => expect(screen.getByText(/New test event/i)).toBeTruthy());
  });

  it("auto-expands test events after sending a test alert", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_test" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({ ok: true, headline: "ok", alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Test alert recorded/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Test alert fired/i)).toBeTruthy());
    expect(screen.getByText(/Hide/i)).toBeTruthy();
  });

  it("keeps test events collapsed when send test fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response("rate limited", { status: 429, headers: { "content-type": "text/plain" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Rate limited/i)).toBeTruthy());
    expect(screen.queryByText(/Test events/i)).toBeNull();
  });

  it("starts cooldown after successful test send and re-enables after 10s", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_test" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              headline: "ok",
              alerts: [],
              recentEvents: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({ ok: true, headline: "ok", alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Test alert recorded/i)).toBeTruthy());
    expect(screen.getByText(/Try again in 10s/i)).toBeTruthy();
    expect((screen.getByText(/Try again in/i) as HTMLButtonElement).closest("button")?.getAttribute("disabled")).not.toBeNull();
    vi.advanceTimersByTime(10_000);
    await waitFor(() => expect(screen.getByText(/Send test alert/i)).toBeTruthy());
    expect((screen.getByText(/Send test alert/i) as HTMLButtonElement).closest("button")?.getAttribute("disabled")).toBeNull();
  });

  it("does not start cooldown when test send fails", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/test")) {
        return Promise.resolve(new Response("rate limited", { status: 429, headers: { "content-type": "text/plain" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send test alert/i));
    await waitFor(() => expect(screen.getByText(/Rate limited/i)).toBeTruthy());
    expect(screen.getByText(/Send test alert/i)).toBeTruthy();
  });

  it("tracks last-loaded timestamps per tab", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = coerceOpsAlertsModel({ ok: true, alerts: [], recentEvents: [] });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    await waitFor(() => {
      const text = screen.getByText(/Firing last loaded:/).textContent ?? "";
      expect(text).not.toContain("--");
    });
    vi.setSystemTime(new Date("2024-01-01T00:00:10.000Z"));
    fireEvent.click(screen.getByText(/Recent/i));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/ops/alerts"))).toBe(true));
    await waitFor(() => {
      const text = screen.getByText(/Recent last loaded:/).textContent ?? "";
      expect(text).not.toContain("--");
    });
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
