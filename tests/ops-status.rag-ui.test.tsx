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
  rag: {
    rulesVersion: "rag_v2_15m_trend",
    window: { minutes: 15, fromIso: "2024-02-10T11:45:00.000Z", toIso: "2024-02-10T12:00:00.000Z" },
    status: "green",
    overall: "green",
    headline: "All clear",
    signals: [],
    topIssues: [],
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

describe("SystemStatusClient RAG UI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        ok: true,
        status: {
          rag: {
            overall: "amber",
            status: "amber",
            rulesVersion: "rag_v2_15m_trend",
            window: { minutes: 15, fromIso: "2024-02-10T11:45:00.000Z", toIso: "2024-02-10T12:00:00.000Z" },
            headline: "Webhook failures (3) in last 15m",
            signals: [
              {
                key: "webhook_failures",
                label: "Webhook failures",
                severity: "amber",
                count: 3,
                topCodes: [{ code: "timeout", count: 3 }],
                topSurfaces: [{ surface: "webhook", count: 3 }],
              },
            ],
            topIssues: [{ key: "webhook_failures", severity: "amber", count: 3, label: "Webhook failures", primaryAction: "/app/ops/webhooks?window=15m" }],
            trend: { bucketMinutes: 15, fromIso: "2024-02-09T12:00:00.000Z", toIso: "2024-02-10T12:00:00.000Z", buckets: [{ at: "2024-02-10T11:45:00.000Z", green: 0, amber: 1, red: 0, score: 60, topSignalKey: "webhook_failures" }], direction: "stable" },
            updatedAt: "2024-02-10T12:00:00.000Z",
          },
          health: baseStatus.health,
          queues: baseStatus.queues,
          limits: baseStatus.limits,
          deployment: baseStatus.deployment,
          now: baseStatus.now,
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
    expect(container.textContent).toContain("System health");
    expect(container.textContent).toContain("AMBER");
    expect(container.textContent).toContain("Webhook failures");
    expect(container.textContent).toContain("Why this status");
    expect(container.textContent).toContain("24h trend");
    const link = Array.from(container.querySelectorAll("a")).find((a) => a.getAttribute("href")?.includes("window=15m"));
    expect(link?.getAttribute("href")).toContain("webhooks");
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
