import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import SystemStatusClient from "@/app/app/ops/status/status-client";

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
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
    topRepeats: { requestIds: [], codes: [], surfaces: [] },
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
  webhookConfig: { configured: true, mode: "enabled", hint: "Webhook notifications enabled.", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: true, hasSecret: true } },
};

describe("SystemStatusClient RAG UI", () => {
  beforeEach(() => {
    logMock.mockReset();
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
              {
                key: "portal_errors",
                label: "Portal errors",
                severity: "amber",
                count: 2,
              },
            ],
            topIssues: [{ key: "webhook_failures", severity: "amber", count: 3, label: "Webhook failures", primaryAction: "/app/ops/webhooks?window=15m" }],
            topRepeats: { requestIds: [{ id: "req_123", count: 3 }], codes: [{ code: "timeout", count: 3 }], surfaces: [] },
            trend: { bucketMinutes: 15, fromIso: "2024-02-09T12:00:00.000Z", toIso: "2024-02-10T12:00:00.000Z", buckets: [{ at: "2024-02-10T11:45:00.000Z", green: 0, amber: 1, red: 0, score: 60, topSignalKey: "webhook_failures" }], direction: "stable" },
            updatedAt: "2024-02-10T12:00:00.000Z",
          },
          health: baseStatus.health,
          queues: baseStatus.queues,
          limits: baseStatus.limits,
          deployment: baseStatus.deployment,
          now: baseStatus.now,
          webhookConfig: baseStatus.webhookConfig,
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
    const deliveriesLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("View deliveries"));
    expect(deliveriesLink?.getAttribute("href")).toContain("tab=deliveries");
    expect(container.textContent).toContain("Send webhook test");
    const portalIncidents = Array.from(container.querySelectorAll("a")).find((a) => a.getAttribute("href")?.includes("surface=portal"));
    expect(portalIncidents?.getAttribute("href")).toContain("window=24h");
    const portalAudits = Array.from(container.querySelectorAll("a")).find((a) => a.getAttribute("href")?.includes("q=portal_error"));
    expect(portalAudits?.getAttribute("href")).toContain("range=24h");
    expect(logMock).toHaveBeenCalledWith("ops_status_triage_view", null, "ops", { window: "15m" });
    container.remove();
  });

  it("disables webhook test when config missing", async () => {
    (fetch as any).mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        ok: true,
        status: {
          ...baseStatus,
          webhookConfig: { configured: false, mode: "missing_url", hint: "missing", setupHref: "/app/ops/status#alerts", safeMeta: { hasUrl: false, hasSecret: false } },
          rag: {
            ...baseStatus.rag,
            signals: [{ key: "webhook_errors", label: "Webhook errors", severity: "amber", count: 1 }],
          },
        },
      }),
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<SystemStatusClient initialStatus={baseStatus as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    const button = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Send webhook test"));
    expect(button?.getAttribute("disabled")).not.toBeNull();
    expect(container.textContent).toContain("Configure webhook first");
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

  it("sends webhook test and logs triage action", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ops/alerts/webhook-test")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, eventId: "evt_test" }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            status: {
              ...baseStatus,
              webhookConfig: baseStatus.webhookConfig,
              rag: {
                ...baseStatus.rag,
                signals: [{ key: "webhook_failures", label: "Webhook failures", severity: "amber", count: 2 }],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<SystemStatusClient initialStatus={baseStatus as any} requestId="req_ui" />);
      await Promise.resolve();
    });
    const button = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Send webhook test"));
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/ops/alerts/webhook-test"))).toBe(true);
    expect(logMock).toHaveBeenCalledWith(
      "ops_status_triage_action_click",
      null,
      "ops",
      expect.objectContaining({ reasonKey: "webhook_failures", action: "send_webhook_test" })
    );
    container.remove();
  });
});
