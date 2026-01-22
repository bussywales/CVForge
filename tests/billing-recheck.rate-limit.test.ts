import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let mockUser: any;
let resetRateLimitStores: (() => void) | null = null;

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
        text: async () => JSON.stringify(body),
      }),
    },
  }));

  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: (h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders(h as any);
      headers.set("x-request-id", "req_test");
      if (opts?.noStore ?? true) {
        headers.set("cache-control", "no-store");
      }
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

  vi.doMock("@/lib/rate-limit", async () => {
    const actual = await import("@/lib/rate-limit");
    resetRateLimitStores = actual.resetRateLimitStores;
    return actual;
  });

  mockUser = { id: "user-1" };
  vi.doMock("@/lib/supabase/server", () => ({
    createServerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: mockUser } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            ilike: () => ({
              order: () => ({
                limit: () => ({ data: [] }),
              }),
            }),
          }),
        }),
      }),
    }),
  }));

  vi.doMock("@/lib/data/credits", () => ({
    getUserCredits: vi.fn().mockResolvedValue(1),
    listCreditActivity: vi.fn().mockResolvedValue([]),
  }));

  vi.doMock("@/lib/data/billing", () => ({
    fetchBillingSettings: vi.fn().mockResolvedValue({ subscription_status: "none" }),
  }));
  vi.doMock("@/lib/billing/billing-status", () => ({
    buildBillingStatus: vi.fn().mockReturnValue({ subscriptionStatus: "none", creditsAvailable: 1, lastBillingEvent: null }),
  }));
  vi.doMock("@/lib/billing/billing-timeline", () => ({
    buildBillingTimeline: vi.fn().mockReturnValue([]),
  }));
  vi.doMock("@/lib/billing/billing-credit-delay", () => ({
    detectCreditDelay: vi.fn().mockReturnValue({ state: "ok" }),
  }));
  vi.doMock("@/lib/webhook-health", () => ({
    computeWebhookHealth: vi.fn().mockReturnValue({ status: "healthy", lastOkAt: null, window: { hours24: { ok: 0, error: 0 }, days7: { ok: 0, error: 0 } } }),
  }));
  vi.doMock("@/lib/billing/billing-correlation", () => ({
    createBillingCorrelation: vi.fn().mockReturnValue({ delay: { state: "none" } }),
  }));
  const mod = await import("@/app/api/billing/recheck/route");
  GET = mod.GET;
});

describe("billing recheck rate limit", () => {
  afterEach(async () => {
    resetRateLimitStores?.();
  });

  it("returns ok when under limit", async () => {
    const res = await GET(new Request("http://localhost/api/billing/recheck", { headers: { "x-real-ip": "1.1.1.1" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.requestId).toBeTruthy();
  });

  it("returns 429 when over limit", async () => {
    // exhaust limit
    for (let i = 0; i < 6; i++) {
      await GET(new Request("http://localhost/api/billing/recheck", { headers: { "x-real-ip": "2.2.2.2" } }));
    }
    const res = await GET(new Request("http://localhost/api/billing/recheck", { headers: { "x-real-ip": "2.2.2.2" } }));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.requestId).toBe("req_test");
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
