/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET_MODEL: any;
let POST_SKIP: any;
let rlAllowed = true;

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
    body: any;
    headers: SimpleHeaders;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.body = init?.body;
      this.headers = new SimpleHeaders(init?.headers ?? {});
    }
    async json() {
      return this.body ? JSON.parse(this.body) : {};
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
    withRequestIdHeaders: (h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders(h as any);
      headers.set("x-request-id", "req_test");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_test" };
    },
    applyRequestIdHeaders: (res: any, requestId: string, opts?: { noStore?: boolean; retryAfterSeconds?: number }) => {
      res.headers.set("x-request-id", requestId);
      if (opts?.noStore ?? true) res.headers.set("cache-control", "no-store");
      if (typeof opts?.retryAfterSeconds === "number") res.headers.set("retry-after", `${opts.retryAfterSeconds}`);
      return res;
    },
    jsonError: ({ code, message, requestId, status = 500, meta }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId, "cache-control": "no-store" }),
      json: async () => ({ error: { code, message, requestId, meta } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "user-123", email: "test@example.com" }, supabase: {} }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rlAllowed, retryAfterSeconds: 7 }),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ budget: "medium", limit: 10, windowMs: 1000 }),
  }));
  vi.doMock("@/lib/onboarding/onboarding", () => ({
    getOnboardingModel: vi.fn(async () => ({
      steps: [],
      doneCount: 0,
      totalCount: 3,
      skipUntil: null,
    })),
    skipOnboarding: vi.fn(async () => null),
  }));

  const modelRoute = await import("@/app/api/onboarding/model/route");
  GET_MODEL = modelRoute.GET;
  const skipRoute = await import("@/app/api/onboarding/skip/route");
  POST_SKIP = skipRoute.POST;
});

describe("onboarding routes", () => {
  it("returns model for authenticated user", async () => {
    rlAllowed = true;
    const res = await GET_MODEL(new Request("http://localhost/api/onboarding/model"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("rate limits skip", async () => {
    rlAllowed = false;
    const res = await POST_SKIP(new Request("http://localhost/api/onboarding/skip", { method: "POST", body: JSON.stringify({}) }));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.meta.limitKey).toBe("onboarding_skip_post");
  });
});
