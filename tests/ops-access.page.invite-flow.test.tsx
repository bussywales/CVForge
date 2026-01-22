/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, beforeEach } from "vitest";
import AccessClient from "@/app/app/ops/access/access-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("ops access page invite flow", () => {
  beforeEach(() => {
    (globalThis.fetch as any) = vi.fn();
    (navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("creates invite for email without user account", async () => {
    const fetchMock = globalThis.fetch as any;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            userFound: false,
            userId: null,
            allowedNow: false,
            source: "blocked",
            record: null,
            invite: null,
            recentInvites: [],
          }),
          { status: 200, headers: { "x-request-id": "req_ui" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            invite: { status: "pending", invitedAt: "2024-01-01T00:00:00.000Z", token: "tok123", link: "https://invite.test/tok123" },
            requestId: "req_ui",
          }),
          { status: 200, headers: { "x-request-id": "req_ui" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            userFound: false,
            userId: null,
            allowedNow: false,
            source: "blocked",
            record: null,
            invite: { status: "pending", invitedAt: "2024-01-01T00:00:00.000Z", token: "tok123", link: "https://invite.test/tok123" },
            recentInvites: [],
          }),
          { status: 200, headers: { "x-request-id": "req_ui" } }
        )
      );

    render(<AccessClient requestId="req_ui" />);
    fireEvent.change(screen.getByPlaceholderText("Email or user id"), { target: { value: "pending@example.com" } });
    fireEvent.click(screen.getByText("Search"));
    await waitFor(() => expect(screen.getByText("Invite")).toBeTruthy());
    fireEvent.click(screen.getByText("Create invite"));
    await waitFor(() => expect(screen.getByText(/Invite link/)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/ops/access/invite", expect.anything());
  });
});
