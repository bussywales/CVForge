import { describe, expect, it } from "vitest";
import { buildBillingTraceSnippet } from "@/lib/billing/billing-trace-snippet";

describe("billing trace snippet", () => {
  const timeline = [
    { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Checkout success", requestId: "req_checkout" },
    { kind: "webhook_received", at: "2024-02-10T10:01:00.000Z", status: "info", label: "Webhook received", requestId: "req_webhook" },
    { kind: "credits_applied", at: "2024-02-10T10:02:00.000Z", status: "ok", label: "Credits applied", requestId: "ref_123" },
  ] as any;

  const webhookHealth = {
    status: "healthy",
    lastOkAt: "2024-02-10T10:01:00.000Z",
    lastErrorAt: null,
    lastErrorCode: null,
    lagSeconds: 30,
    window: { hours24: { ok: 3, error: 0 }, days7: { ok: 3, error: 0 } },
  };

  const delay = { state: "watching", message: "Processing", nextSteps: [], severity: "low", requestId: "req_checkout" } as any;

  it("includes headline, webhook summary, and recent events", () => {
    const snippet = buildBillingTraceSnippet({ requestId: "req_checkout", timeline, webhook: webhookHealth as any, delay });
    expect(snippet).toContain("CVForge billing trace");
    expect(snippet).toContain("Webhook: healthy");
    expect(snippet).toContain("checkout_success");
    expect(snippet).not.toContain("http://");
  });

  it("omits reference when not provided", () => {
    const snippet = buildBillingTraceSnippet({ requestId: null, timeline, webhook: webhookHealth as any, delay });
    expect(snippet).not.toContain("Reference:");
  });
});
