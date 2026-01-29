/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";
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

describe("ops alerts training deep link", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logMock.mockReset();
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams("from=ops_training&eventId=evt_train&tab=recent");
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls and highlights training event", async () => {
    let alertsCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/workflow")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, ownership: {}, snoozes: {} }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts/deliveries")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, deliveries: [] }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (url.includes("/api/ops/alerts")) {
        alertsCalls += 1;
        const includeEvent = alertsCalls >= 2;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              alerts: [],
              recentEvents: includeEvent
                ? [
                    {
                      id: "evt_train",
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
    render(<AlertsClient initial={initial} requestId="req_train" />);

    await waitFor(() => expect(screen.getByText(/Training scenario view/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Waiting for event to appear/i)).toBeTruthy());
    await vi.advanceTimersByTimeAsync(2000);

    await waitFor(() => expect(screen.getByText(/Test alert recorded/i)).toBeTruthy());
    const highlighted = document.getElementById("ops-training-event-evt_train");
    expect(highlighted?.className).toContain("bg-amber-50");
  });
});
