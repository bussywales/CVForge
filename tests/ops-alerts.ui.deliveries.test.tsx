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

describe("Ops alerts deliveries UI", () => {
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

  it("filters deliveries and expands failure details", async () => {
    const deliveries = [
      {
        deliveryId: "del_1",
        eventId: "evt_1",
        status: "failed",
        attempt: 1,
        isTest: true,
        createdAt: "2024-01-01T00:01:00.000Z",
        headline: "Webhook test notification",
        reason: "status_500",
      },
    ];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } } as any);
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [],
      recentEvents: [],
      webhookConfig: { configured: true, mode: "enabled", hint: "enabled", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: true, hasSecret: true } },
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Recent/i));
    await waitFor(() => expect(screen.getByText(/Webhook test notification/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Why\?/i));
    expect(screen.getByText(/Reason: status_500/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Copy support snippet/i));
    expect((navigator as any).clipboard.writeText).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/^Failed$/i));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("status=failed"))).toBe(true));
  });
});
