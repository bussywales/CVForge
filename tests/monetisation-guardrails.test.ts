import { describe, expect, it } from "vitest";
import { sanitizeMonetisationMeta, shouldDedupMonetisationEvent, type BasicStorage } from "@/lib/monetisation-guardrails";

function createMemoryStorage(): BasicStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("monetisation guardrails", () => {
  it("redacts URLs, emails, and large blobs", () => {
    const meta = sanitizeMonetisationMeta({
      stepKey: "first_outreach",
      url: "https://example.com/path?q=secret",
      email: "person@example.com",
      blob: { payload: "x".repeat(200) },
      ok: "keep",
    });

    expect(meta.url).toBe("[url-redacted]");
    expect(meta.email).toBe("[email-redacted]");
    expect(meta.stepKey).toBe("first_outreach");
    expect(meta.ok).toBe("keep");
    expect(meta.blob).toBe("[omitted]");
  });

  it("dedupes activation events per day", () => {
    const storage = createMemoryStorage();
    const now = Date.UTC(2024, 0, 1);

    expect(shouldDedupMonetisationEvent("activation_view", storage, now)).toBe(false);
    expect(shouldDedupMonetisationEvent("activation_view", storage, now)).toBe(true);
    expect(shouldDedupMonetisationEvent("activation_view", storage, now + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("dedupes keep momentum events per week", () => {
    const storage = createMemoryStorage();
    const monday = Date.UTC(2024, 0, 1); // Monday

    expect(shouldDedupMonetisationEvent("keep_momentum_view", storage, monday)).toBe(false);
    expect(shouldDedupMonetisationEvent("keep_momentum_view", storage, monday + 2 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(shouldDedupMonetisationEvent("keep_momentum_view", storage, monday + 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});
