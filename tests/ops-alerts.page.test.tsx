/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("Ops Alerts page client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, alerts: [], recentEvents: [], firingCount: 0 }) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders headline and tabs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const initial = {
      window: { minutes: 15, fromIso: "", toIso: "" },
      rulesVersion: "ops_alerts_v1_15m",
      headline: "No alerts",
      firingCount: 0,
      alerts: [],
      recentEvents: [],
      webhookConfigured: false,
    };
    await act(async () => {
      ReactDOM.createRoot(container).render(<AlertsClient initial={initial as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Alerts");
    expect(container.textContent).toContain("No alerts firing");
    container.remove();
  });
});
