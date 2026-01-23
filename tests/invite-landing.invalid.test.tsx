/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import InviteLandingClient from "@/components/InviteLandingClient";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("InviteLandingClient invalid token", () => {
  it("shows invalid state and copy snippet", async () => {
    (global as any).fetch = vi.fn(async () => ({
      json: async () => ({ ok: true, valid: false, reason: "expired" }),
    })) as any;
    render(<InviteLandingClient token="tok-invalid" />);
    await waitFor(() => screen.getByText(/Invite link invalid or expired/i));
    expect(screen.getByText(/Copy support snippet/i)).toBeTruthy();
  });
});
