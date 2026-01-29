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

describe("Ops alerts webhook test UI", () => {
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

  it("disables webhook test when not configured", () => {
    const initial = coerceOpsAlertsModel({
      ok: true,
      alerts: [],
      recentEvents: [],
      webhookConfig: { configured: false, mode: "missing_url", hint: "missing", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: false, hasSecret: false } },
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    const button = screen.getByText(/Send webhook test/i).closest("button");
    expect(button?.getAttribute("disabled")).not.toBeNull();
  });

  it("queues webhook test and polls deliveries until receipt appears", async () => {
    let deliveryCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/webhook-test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_webhook" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        deliveryCalls += 1;
        const deliveries =
          deliveryCalls >= 3
            ? [{ deliveryId: "del_1", eventId: "evt_webhook", status: "delivered", attempt: 1, isTest: true, createdAt: "2024-01-01T00:01:00.000Z", headline: "Webhook test notification", reason: null }]
            : [];
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries }), { status: 200, headers: { "content-type": "application/json" } }));
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
      recentEvents: [],
      webhookConfig: { configured: true, mode: "enabled", hint: "enabled", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: true, hasSecret: true } },
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send webhook test/i));
    await waitFor(() => expect(screen.getByText(/Waiting for delivery receipt/i)).toBeTruthy());
    await vi.advanceTimersByTimeAsync(6000);
    await waitFor(() => expect(screen.getByText(/Webhook test notification/i)).toBeTruthy());
  });

  it("shows banner when webhook test fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/webhook-test")) {
        return Promise.resolve(new Response("nope", { status: 500, headers: { "content-type": "text/plain" } }));
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
      recentEvents: [],
      webhookConfig: { configured: true, mode: "enabled", hint: "enabled", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: true, hasSecret: true } },
    });
    render(<AlertsClient initial={initial} requestId="req_ui" />);
    fireEvent.click(screen.getByText(/Send webhook test/i));
    await waitFor(() => expect(screen.getByText(/Webhook test failed|Unable to/i)).toBeTruthy());
  });
});
