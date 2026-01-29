/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import CaseClient from "@/app/app/ops/case/case-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/case",
  useSearchParams: () => searchParamsValue,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("Ops case view", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/ops/alerts")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [], firingCount: 0, handled: {} }), { status: 200, headers: { "content-type": "application/json" } })
          );
        }
        if (url.includes("/api/ops/incidents/preview")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [], count: 0 }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/audits")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/webhook-failures")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/resolution-outcomes/recent")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/watch")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, records: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders empty state when no query", () => {
    render(<CaseClient initialQuery={{ requestId: null, userId: null, email: null, window: null, from: null }} requestId="req_test" />);
    expect(screen.getByText(/Paste a requestId to begin/i)).toBeTruthy();
  });

  it("submits search and updates URL once", () => {
    render(<CaseClient initialQuery={{ requestId: null, userId: null, email: null, window: null, from: null }} requestId="req_test" />);
    const input = screen.getByPlaceholderText(/req_.../i);
    fireEvent.change(input, { target: { value: "req_123" } });
    fireEvent.click(screen.getByText("Search"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toContain("requestId=req_123");
  });

  it("shows snippet copy when query is present", async () => {
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(<CaseClient initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }} requestId="req_test" />);
    await waitFor(() => expect(screen.getByText(/Copy case snippet/i)).toBeTruthy());
  });
});
