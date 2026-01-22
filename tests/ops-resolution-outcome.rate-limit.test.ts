import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;

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
    body?: any;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "POST";
      this.headers = new SimpleHeaders(init?.headers ?? {});
      this.body = init?.body;
    }
    async json() {
      return JSON.parse(this.body ?? "{}");
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
        text: async () => JSON.stringify(body),
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
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId, "cache-control": "no-store" }),
      json: async () => ({ error: { code, message, requestId } }),
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-1", email: "ops@test.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "ops" }),
    isOpsRole: () => true,
  }));

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({}),
  }));

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: vi.fn().mockResolvedValue({
      id: "activity-1",
      body: "{}",
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      type: "monetisation.ops_resolution_outcome_set",
    }),
  }));

  vi.doMock("@/lib/ops/ops-resolution-outcomes", () => ({
    buildOutcomeEvent: vi.fn().mockReturnValue({}),
    mapOutcomeRows: vi.fn().mockReturnValue([
      {
        id: "activity-1",
        code: "PORTAL_RETRY_SUCCESS",
        createdAt: new Date().toISOString(),
        actorMasked: null,
        requestId: "req_a",
        userId: "user_a",
        note: null,
        effectivenessState: "unknown",
        effectivenessReason: null,
        effectivenessNote: null,
        effectivenessUpdatedAt: new Date().toISOString(),
        effectivenessDeferredUntil: null,
      },
    ]),
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: vi.fn(),
  }));

  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: false, retryAfterSeconds: 7, status: 429 }),
    resetRateLimitStores: () => {},
    getRateLimitSummary: () => ({ rateLimitHits: { billing_recheck: 0, monetisation_log: 0, ops_actions: 1 }, topLimitedRoutes24h: [] }),
  }));

  const mod = await import("@/app/api/ops/resolution-outcome/route");
  POST = mod.POST;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ops resolution outcome rate limit", () => {
  it("returns 429 with retry headers when limited", async () => {
    const res = await POST(
      new Request("http://localhost/api/ops/resolution-outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "PORTAL_RETRY_SUCCESS", requestId: "req1" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.requestId).toBe("req_test");
    expect(res.headers.get("retry-after")).toBe("7");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
