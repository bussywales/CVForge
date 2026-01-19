import { describe, expect, it, vi } from "vitest";
import { applyBillingDeeplinkIntent } from "@/lib/billing/billing-deeplink-apply";

describe("applyBillingDeeplinkIntent", () => {
  it("retries until element appears then calls onFound", () => {
    vi.useFakeTimers();
    let calls = 0;
    const el = {} as HTMLElement;
    applyBillingDeeplinkIntent({
      intent: { anchor: "packs" },
      getElement: () => {
        calls += 1;
        return calls >= 3 ? el : null;
      },
      onFound: (found, elapsed) => {
        expect(found).toBe(el);
        expect(elapsed).toBeGreaterThanOrEqual(200);
      },
    });
    vi.runAllTimers();
    expect(calls).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it("calls onMissing when element never appears", () => {
    vi.useFakeTimers();
    let missingCalled = false;
    applyBillingDeeplinkIntent({
      intent: { anchor: "packs" },
      getElement: () => null,
      onFound: () => {
        throw new Error("should not find");
      },
      onMissing: (elapsed) => {
        missingCalled = true;
        expect(elapsed).toBeGreaterThanOrEqual(500);
      },
      intervalMs: 100,
      maxMs: 500,
    });
    vi.runAllTimers();
    expect(missingCalled).toBe(true);
    vi.useRealTimers();
  });
});

