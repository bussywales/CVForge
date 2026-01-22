/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";

describe("onboarding logging guardrails", () => {
  it("dedupes onboarding_card_view daily", async () => {
    const storage: Record<string, string> = {};
    const basicStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: () => undefined,
    };
    const { shouldDedupMonetisationEvent } = await import("@/lib/monetisation-guardrails");
    const first = shouldDedupMonetisationEvent("onboarding_card_view", basicStorage as any, 1700000000000);
    const second = shouldDedupMonetisationEvent("onboarding_card_view", basicStorage as any, 1700000100000);
    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it("sanitises meta without leaking urls", async () => {
    const { sanitizeMonetisationMeta } = await import("@/lib/monetisation-guardrails");
    const meta = sanitizeMonetisationMeta({ destination: "https://example.com/app", step: "create_cv" });
    expect(meta.destination).toBe("[url-redacted]");
    expect(meta.step).toBe("create_cv");
  });
});
