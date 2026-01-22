/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";

describe("ops alerts helper", () => {
  it("fires rag red alert", async () => {
    const { buildOpsAlerts } = await import("@/lib/ops/ops-alerts");
    const now = new Date("2024-01-01T00:00:00.000Z");
    const model = buildOpsAlerts({
      now,
      rag15m: {
        rulesVersion: "rag_v2_15m_trend",
        window: { minutes: 15, fromIso: now.toISOString(), toIso: now.toISOString() },
        status: "red",
        overall: "red",
        headline: "Webhook failures",
        signals: [],
        topIssues: [{ key: "webhook_failures", label: "Webhook failures", severity: "red", count: 5, primaryAction: "/app/ops/webhooks", secondaryAction: null }],
        trend: { bucketMinutes: 15, fromIso: now.toISOString(), toIso: now.toISOString(), buckets: [], direction: "stable" },
        topRepeats: { requestIds: [], codes: [], surfaces: [] },
        updatedAt: now.toISOString(),
      } as any,
      webhookFailures: { count: 0, repeats: 0 },
      portalErrors15m: 0,
      rateLimit15m: { hits: 0, topRoutes: [] },
    });
    const ragAlert = model.alerts.find((a) => a.key === "ops_alert_rag_red");
    expect(ragAlert?.state).toBe("firing");
    expect(model.firingCount).toBeGreaterThan(0);
  });

  it("uses thresholds for spikes", async () => {
    const { buildOpsAlerts } = await import("@/lib/ops/ops-alerts");
    const now = new Date("2024-01-01T00:00:00.000Z");
    const model = buildOpsAlerts({
      now,
      rag15m: null,
      webhookFailures: { count: 4, repeats: 1 },
      portalErrors15m: 6,
      rateLimit15m: { hits: 25, topRoutes: [{ route: "/api/billing/recheck", count: 10 }] },
    });
    const webhooks = model.alerts.find((a) => a.key === "ops_alert_webhook_failures_spike");
    const portal = model.alerts.find((a) => a.key === "ops_alert_portal_errors_spike");
    const rate = model.alerts.find((a) => a.key === "ops_alert_rate_limit_pressure");
    expect(webhooks?.state).toBe("firing");
    expect(portal?.state).toBe("firing");
    expect(rate?.state).toBe("firing");
  });
});
