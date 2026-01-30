/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CasesClient from "@/app/app/ops/cases/cases-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();
let casesResponse: any = { ok: true, items: [], nextCursor: null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/cases",
  useSearchParams: () => searchParamsValue,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("Ops cases queue", () => {
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

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/ops/cases?")) {
          return Promise.resolve(new Response(JSON.stringify(casesResponse), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/cases/claim")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                workflow: { requestId: "req_123", status: "open", priority: "p2", assignedToUserId: "user_ops", lastTouchedAt: "2024-01-01T02:10:00.000Z" },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }
        if (url.includes("/api/ops/cases/release")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                workflow: { requestId: "req_123", status: "open", priority: "p2", assignedToUserId: null, lastTouchedAt: "2024-01-01T02:15:00.000Z" },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }
        if (url.includes("/api/ops/cases/update")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                workflow: { requestId: "req_123", status: "monitoring", priority: "p1", assignedToUserId: null, lastTouchedAt: "2024-01-01T02:20:00.000Z" },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  it("renders cases list", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    await waitFor(() => expect(screen.getByText("req_123")).toBeTruthy());
    expect(screen.getByText(/Open case/i)).toBeTruthy();
    expect(screen.getByText(/SLA:/i)).toBeTruthy();
  });

  it("updates URL when status filter changes", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    const statusSelect = await screen.findByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: "open" } });
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("opens a case with returnTo", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    const link = await screen.findByText("Open case");
    expect(link.getAttribute("href")).toContain("returnTo=");
  });

  it("selects a saved view and updates URL", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    fireEvent.click(await screen.findByText("My queue"));
    expect(replaceMock).toHaveBeenCalled();
    const call = replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0];
    expect(call).toContain("view=my");
    expect(call).toContain("assigned=me");
  });

  it("switches to custom view on manual filter change", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    fireEvent.click(await screen.findByText("My queue"));
    replaceMock.mockClear();
    const statusSelect = await screen.findByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: "open" } });
    const call = replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0];
    expect(call).toContain("view=custom");
  });

  it("claims and releases a case", async () => {
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    const claimButton = await screen.findByText("Claim");
    fireEvent.click(claimButton);
    await waitFor(() => expect(screen.getByText(/Release/)).toBeTruthy());
    fireEvent.click(screen.getByText("Release"));
    await waitFor(() => expect(screen.getByText(/Claim/)).toBeTruthy());
  });

  it("shows empty state", async () => {
    casesResponse = { ok: true, items: [], nextCursor: null };
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    await waitFor(() => expect(screen.getByText(/No cases match/i)).toBeTruthy());
  });

  it("polls without updating history", async () => {
    vi.useFakeTimers();
    const fetchMock = global.fetch as any;
    render(<CasesClient initialQuery={{}} viewerRole="support" viewerId="user_ops" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();
    replaceMock.mockClear();
    vi.advanceTimersByTime(20000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(replaceMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
