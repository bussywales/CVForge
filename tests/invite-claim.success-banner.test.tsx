/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import InviteAutoClaimClient from "@/app/app/invite-auto-claim-client";

vi.useFakeTimers();

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("InviteAutoClaimClient success banner", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("cvf_invite_token", "tok-success");
    (global as any).fetch = vi.fn(async () => ({
      json: async () => ({ ok: true }),
    })) as any;
  });

  it("shows success banner and CTA", async () => {
    render(<InviteAutoClaimClient />);
    await waitFor(() => screen.getByText(/Invite applied/));
    const cta = screen.getByText(/Create your first CV/);
    expect((cta as HTMLAnchorElement).getAttribute("href")).toContain("/app/applications/new");
    vi.runAllTimers();
  });
});
