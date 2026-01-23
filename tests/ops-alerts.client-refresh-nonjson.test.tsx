/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";

vi.mock("@/lib/http/safe-json", () => ({
  fetchJsonSafe: vi.fn(async () => ({ ok: false, status: 500, error: { code: "NON_JSON_RESPONSE", message: "bad" } })),
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("AlertsClient refresh non-json", () => {
  it("shows banner and keeps state", async () => {
    render(
      <AlertsClient
        initial={{
          window: { minutes: 15, fromIso: "", toIso: "" },
          rulesVersion: "test",
          headline: "ok",
          firingCount: 0,
          alerts: [],
          recentEvents: [],
          webhookConfigured: true,
        }}
        requestId="req_test"
      />
    );
    fireEvent.click(screen.getByText(/Refresh/));
    await waitFor(() => screen.getByText(/Unable to load alerts/));
    expect(screen.getByText(/No alerts firing/)).toBeTruthy();
  });
});
