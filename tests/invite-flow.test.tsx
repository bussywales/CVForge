/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InviteLandingClient from "@/components/InviteLandingClient";
import InviteAutoClaimClient from "@/app/app/invite-auto-claim-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("invite landing + claim", () => {
  const originalLocation = window.location;
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it("stores token and continues from landing", () => {
    render(<InviteLandingClient token="tok123" />);
    fireEvent.click(screen.getByText("Continue"));
    expect(localStorage.getItem("cvf_invite_token")).toBe("tok123");
    expect(window.location.href).toContain("/login");
  });

  it("allows claim now when authed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) } as any);
    global.fetch = fetchMock as any;
    render(<InviteLandingClient token="abc" isAuthed />);
    fireEvent.click(screen.getByText("Claim invite now"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(window.location.href).toContain("/app");
  });

  it("shows banner when claim fails then retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: { requestId: "req-1" } }) } as any)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) } as any);
    global.fetch = fetchMock as any;
    localStorage.setItem("cvf_invite_token", "tok");
    render(<InviteAutoClaimClient />);
    await waitFor(() => screen.getByText(/couldn’t be claimed yet/i));
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
