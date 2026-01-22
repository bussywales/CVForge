import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, getRateLimitSummary, resetRateLimitStores } from "@/lib/rate-limit";

describe("rate-limit helper", () => {
  afterEach(() => {
    resetRateLimitStores();
  });

  it("allows within limit", () => {
    const res1 = checkRateLimit({ route: "billing_recheck", identifier: "user1", limit: 2, windowMs: 1000, now: 0 });
    const res2 = checkRateLimit({ route: "billing_recheck", identifier: "user1", limit: 2, windowMs: 1000, now: 500 });
    expect(res1.allowed).toBe(true);
    expect(res2.allowed).toBe(true);
  });

  it("returns retry-after when exceeded", () => {
    checkRateLimit({ route: "billing_recheck", identifier: "user2", limit: 1, windowMs: 1000, now: 0 });
    const res = checkRateLimit({ route: "billing_recheck", identifier: "user2", limit: 1, windowMs: 1000, now: 500 });
    if (res.allowed) throw new Error("expected rate limit");
    expect(res.status).toBe(429);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    const summary = getRateLimitSummary({ sinceMs: -1 });
    expect(summary.rateLimitHits.billing_recheck).toBe(1);
    expect(summary.topLimitedRoutes24h[0]?.route).toBe("billing_recheck");
  });

  it("keys by identifier", () => {
    const first = checkRateLimit({ route: "monetisation_log", identifier: "user3", limit: 1, windowMs: 1000, now: 0 });
    const second = checkRateLimit({ route: "monetisation_log", identifier: "user4", limit: 1, windowMs: 1000, now: 0 });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });
});
