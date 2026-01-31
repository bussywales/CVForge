/// <reference types="vitest/globals" />
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CasesClient from "@/app/app/ops/cases/cases-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();
let casesResponse: any = { ok: true, items: [], nextCursor: null };
let viewsResponse: any = { ok: true, views: [] };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/cases",
  useSearchParams: () => searchParamsValue,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("ops cases polling", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    casesResponse = {
      ok: true,
      items: [
        {
          requestId: "req_123",
          status: "open",
          priority: "p2",
          assignedUserId: null,
          assignedToMe: false,
          lastTouchedAt: "2024-01-01T02:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
          slaDueAt: "2024-01-01T04:00:00.000Z",
          slaBreached: false,
          slaRemainingMs: 3600000,
          notesCount: 1,
          evidenceCount: 2,
          userContext: { userId: "user_ctx", source: "ops_audit", confidence: "high" },
        },
      ],
      nextCursor: null,
    };
    viewsResponse = { ok: true, views: [] };

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/ops/cases/views")) {
          return Promise.resolve(new Response(JSON.stringify(viewsResponse), { status: 200, headers: { "content-type": "application/json" } }));
        }
        return Promise.resolve(new Response(JSON.stringify(casesResponse), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  it("backs off polling and pauses when hidden", async () => {
    vi.useFakeTimers();
    const fetchMock = global.fetch as any;
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fetchMock.mockClear();
    vi.advanceTimersByTime(20000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fetchMock.mockClear();
    vi.advanceTimersByTime(20000);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    fetchMock.mockClear();
    vi.advanceTimersByTime(60000);
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(20000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    vi.useRealTimers();
  });
});
