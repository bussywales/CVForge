/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;

beforeAll(async () => {
  class SimpleHeaders {
    private store: Record<string, string> = {};
    constructor(init?: Record<string, string>) {
      Object.entries(init ?? {}).forEach(([k, v]) => (this.store[k.toLowerCase()] = v));
    }
    set(key: string, value: string) {
      this.store[key.toLowerCase()] = value;
    }
    get(key: string) {
      return this.store[key.toLowerCase()] ?? null;
    }
  }
  class SimpleRequest {
    url: string;
    method: string;
    headers: SimpleHeaders;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new SimpleHeaders(init?.headers ?? {});
    }
  }
  (globalThis as any).Headers = SimpleHeaders as any;
  (globalThis as any).Request = SimpleRequest as any;

  vi.doMock("next/server", () => ({
    NextResponse: {
      json: (body: any, init?: { status?: number; headers?: Headers }) => ({
        status: init?.status ?? 200,
        headers: init?.headers ?? new SimpleHeaders(),
        json: async () => body,
      }),
    },
  }));
  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: () => {
      const headers = new SimpleHeaders();
      headers.set("x-request-id", "req_test");
      headers.set("cache-control", "no-store");
      return { headers, requestId: "req_test" };
    },
    applyRequestIdHeaders: (res: any, requestId: string, opts?: { noStore?: boolean; retryAfterSeconds?: number }) => {
      res.headers.set("x-request-id", requestId);
      if (opts?.noStore ?? true) res.headers.set("cache-control", "no-store");
      if (typeof opts?.retryAfterSeconds === "number") res.headers.set("retry-after", `${opts.retryAfterSeconds}`);
      return res;
    },
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId, "cache-control": "no-store" }),
      json: async () => ({ error: { code, message, requestId } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockResolvedValue({ role: "support" }),
    isOpsRole: () => true,
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true }),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 1000, budget: "medium" }),
  }));
  vi.doMock("@/lib/ops/ops-resolution-outcomes", () => ({
    listRecentOutcomes: async () => [{ id: "out_1", code: "OTHER", createdAt: "2024-01-01T00:00:00.000Z", requestId: "req_1" }],
    maskResolutionOutcome: (o: any) => ({ id: o.id ?? null, code: o.code, createdAt: o.createdAt, requestId: o.requestId ?? null }),
  }));

  const route = await import("@/app/api/ops/resolution-outcomes/recent/route");
  GET = route.GET;
});

describe("ops resolution outcomes recent route", () => {
  it("returns masked outcomes", async () => {
    const res = await GET(new Request("http://localhost?requestId=req_1"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items[0].code).toBe("OTHER");
  });
});
