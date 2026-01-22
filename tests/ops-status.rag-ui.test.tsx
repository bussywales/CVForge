import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import SystemStatusClient from "@/app/app/ops/status/status-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

const baseStatus = {
  deployment: { vercelId: null, matchedPath: null },
  now: "2024-02-10T12:00:00.000Z",
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

describe("SystemStatusClient RAG UI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        ok: true,
        rag: {
          overall: "green",
          reasons: [{ area: "webhook", level: "amber", code: "webhook_failures", count: 3, hint: "Webhook failures elevated" }],
          window: "15m",
          updatedAt: "2024-02-10T12:00:00.000Z",
          metrics: { portalErrors: 0, checkoutErrors: 0, webhookFailures: 3, webhookRepeats: 1, rateLimit429s: 0 },
        },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders rag pill and links", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<SystemStatusClient initialStatus={baseStatus as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("System Health");
    expect(container.textContent).toContain("GREEN");
    expect(container.textContent).toContain("Webhooks: 3");
    expect(container.textContent).toContain("Open Webhook Failures");
    container.remove();
  });

  it("shows error banner when fetch fails", async () => {
    (fetch as any).mockResolvedValueOnce({
      status: 500,
      headers: new Headers(),
      json: async () => ({ ok: false, error: { code: "RAG_ERROR", message: "fail", requestId: "req123" } }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<SystemStatusClient initialStatus={baseStatus as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("System health error");
    container.remove();
  });
});
