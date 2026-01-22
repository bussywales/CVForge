/// <reference types="vitest/globals" />
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import SystemStatusClient from "@/app/app/ops/status/status-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

const baseStatus = {
  deployment: { vercelId: null, matchedPath: null },
  now: "2024-02-10T12:00:00.000Z",
  rag: {
    rulesVersion: "rag_v2_15m_trend",
    window: { minutes: 15, fromIso: "2024-02-10T11:45:00.000Z", toIso: "2024-02-10T12:00:00.000Z" },
    status: "amber",
    overall: "amber",
    headline: "Webhook failures (2) in last 15m",
    signals: [],
    topIssues: [],
    topRepeats: { requestIds: [{ id: "req_99", count: 2 }], codes: [{ code: "timeout", count: 2 }], surfaces: [{ surface: "webhook", count: 2 }] },
    trend: { bucketMinutes: 15, fromIso: "2024-02-09T12:00:00.000Z", toIso: "2024-02-10T12:00:00.000Z", buckets: [], direction: "stable" },
    updatedAt: "2024-02-10T12:00:00.000Z",
  },
  health: {
    billingRecheck429_24h: 0,
    portalErrors_24h: 0,
    webhookFailures_24h: 0,
    webhookRepeats_24h: 0,
    incidents_24h: 0,
    audits_24h: 0,
  },
  queues: { webhookFailuresQueue: { count24h: 0, lastSeenAt: null, firstSeenAt: null, repeatsTop: null } },
  limits: { rateLimitHits24h: { billing_recheck: 0, monetisation_log: 0, ops_actions: 0 }, topLimitedRoutes24h: [], approx: true },
  notes: [],
};

describe("SystemStatusClient top repeats", () => {
  beforeEach(() => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          return {
            status: 200,
            headers: new Headers(),
            json: async () => ({ ok: true, status: baseStatus }),
          } as any;
        }
        return {
          status: 200,
          headers: new Headers(),
          json: async () => ({ ok: true }),
        } as any;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders top repeats and builds links", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<SystemStatusClient initialStatus={baseStatus as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Top repeats");
    const link = container.querySelector('a[href*="requestId=req_99"]');
    expect(link?.getAttribute("href")).toContain("window=15m");

    const watchButton = Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Watch");
    if (!watchButton) throw new Error("watch button missing");
    await act(async () => {
      watchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Watch created");
    container.remove();
  });
});
