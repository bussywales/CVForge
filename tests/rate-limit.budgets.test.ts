/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";

class SimpleHeaders {
  private store: Record<string, string> = {};
  constructor(init?: Record<string, string>) {
    Object.entries(init ?? {}).forEach(([k, v]) => (this.store[k.toLowerCase()] = v));
  }
  get(key: string) {
    return this.store[key.toLowerCase()] ?? null;
  }
  set(key: string, value: string) {
    this.store[key.toLowerCase()] = value;
  }
}

class SimpleResponse {
  status: number;
  headers: SimpleHeaders;
  private body: any;
  constructor(body: any, init?: { status?: number; headers?: Record<string, string> }) {
    this.status = init?.status ?? 200;
    this.headers = new SimpleHeaders(init?.headers);
    this.body = body;
  }
  async json() {
    return typeof this.body === "string" ? JSON.parse(this.body) : this.body;
  }
}

(globalThis as any).Response = SimpleResponse as any;
(globalThis as any).Headers = SimpleHeaders as any;

describe("rate-limit budgets", () => {
  it("returns budget per route", async () => {
    const { getRateLimitBudget } = await import("@/lib/rate-limit-budgets");
    const budget = getRateLimitBudget("billing_recheck");
    expect(budget.budget).toBe("low");
    expect(budget.limit).toBeGreaterThan(0);
  });

  it("includes meta on jsonError", async () => {
    const { jsonError } = await import("@/lib/observability/request-id");
    const res = jsonError({ code: "RATE_LIMITED", message: "rl", requestId: "req_test", status: 429, meta: { limitKey: "billing_recheck", retryAfterSeconds: 10 } });
    const body = await res.json();
    expect(body.error.meta.limitKey).toBe("billing_recheck");
    expect(body.error.meta.retryAfterSeconds).toBe(10);
  });
});
