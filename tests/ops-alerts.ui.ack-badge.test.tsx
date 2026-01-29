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

describe("Ops alerts handled badges", () => {
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
  });

  it("renders handled badge for test event and logs curl copy", async () => {
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
    const ackButton = screen.getByText(/Acknowledged|Acknowledge/i);
    expect(ackButton.closest("button")?.getAttribute("disabled")).not.toBeNull();
    fireEvent.click(screen.getByText(/Copy ACK curl/i));
    await waitFor(() => expect(logMock).toHaveBeenCalledWith("ops_alerts_ack_curl_copy", null, "ops", { meta: { window: "15m" } }));
  });
});
