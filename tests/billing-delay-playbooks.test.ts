import { describe, expect, it } from "vitest";
import { buildDelayPlaybook } from "@/lib/billing/billing-delay-playbooks";

const baseCorrelation = {
  correlation: {
    checkout: { at: "2024-02-10T10:00:00.000Z", ok: true, requestId: "req_checkout" },
    webhook: { at: null, ok: false },
    ledger: { at: null, ok: false },
  },
  delay: { state: "waiting_webhook", confidence: "high", explanation: "", since: "2024-02-10T10:00:00.000Z" },
  evidence: [],
} as any;

describe("buildDelayPlaybook", () => {
  it("maps waiting_webhook to expected guidance", () => {
    const res = buildDelayPlaybook({ correlation: baseCorrelation, supportPath: "/app/billing", requestId: "req_1" });
    expect(res?.title).toMatch(/awaiting webhook/i);
    expect(res?.ctas.some((c) => c.kind === "recheck")).toBe(true);
  });

  it("maps waiting_ledger to ledger guidance", () => {
    const corr = { ...baseCorrelation, delay: { ...baseCorrelation.delay, state: "waiting_ledger" } };
    const res = buildDelayPlaybook({ correlation: corr, supportPath: "/app/billing" });
    expect(res?.summary).toMatch(/credits/);
  });

  it("maps ui_stale to refresh guidance", () => {
    const corr = { ...baseCorrelation, delay: { ...baseCorrelation.delay, state: "ui_stale" } };
    const res = buildDelayPlaybook({ correlation: corr, supportPath: "/app/billing" });
    expect(res?.ctas.some((c) => c.kind === "copy_snippet")).toBe(true);
  });

  it("maps unknown to conservative guidance", () => {
    const corr = { ...baseCorrelation, delay: { ...baseCorrelation.delay, state: "unknown" } };
    const res = buildDelayPlaybook({ correlation: corr, supportPath: "/app/billing" });
    expect(res?.title).toMatch(/investigating/i);
  });
});
