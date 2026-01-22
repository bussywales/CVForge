import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let mockUser: any;
let timelineMock: any[];
let creditsMock: any;

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

  mockUser = { id: "user-1", email: "user@example.com" };
  const monetisationEvents: any[] = [
    { type: "monetisation.checkout_success", occurred_at: "2024-02-10T10:00:00.000Z", body: JSON.stringify({ requestId: "req_checkout" }) },
  ];

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
                limit: () => ({ data: monetisationEvents }),
              }),
            }),
          }),
        }),
      }),
    }),
  }));

  creditsMock = vi.fn().mockResolvedValue(3);
  vi.doMock("@/lib/data/credits", () => ({
    getUserCredits: (...args: any[]) => creditsMock(...args),
    listCreditActivity: vi.fn().mockResolvedValue([]),
  }));

  vi.doMock("@/lib/data/billing", () => ({
    fetchBillingSettings: vi.fn().mockResolvedValue({ subscription_status: "none", stripe_customer_id: null, stripe_subscription_id: null }),
  }));

  vi.doMock("@/lib/billing/billing-status", () => ({
    buildBillingStatus: vi.fn().mockReturnValue({ subscriptionStatus: "none", creditsAvailable: 3, lastBillingEvent: null }),
  }));

  timelineMock = [
    { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Checkout success", requestId: "req_checkout" },
  ];
  vi.doMock("@/lib/billing/billing-timeline", () => ({
    buildBillingTimeline: vi.fn().mockReturnValue(timelineMock),
  }));
  vi.doMock("@/lib/billing/billing-credit-delay", () => ({
    detectCreditDelay: vi.fn().mockReturnValue({ state: "watching", message: "wait", nextSteps: [], severity: "low" }),
  }));
  vi.doMock("@/lib/webhook-health", () => ({
    computeWebhookHealth: vi.fn().mockReturnValue({
      status: "healthy",
      lastOkAt: "2024-02-10T10:00:00.000Z",
      lastErrorAt: null,
      lastErrorCode: null,
      lagSeconds: 0,
      window: { hours24: { ok: 1, error: 0 }, days7: { ok: 1, error: 0 } },
    }),
  }));

  const mod = await import("@/app/api/billing/recheck/route");
  GET = mod.GET;
});

describe("billing recheck route", () => {
  it("returns ok model with timeline and webhook health", async () => {
    const res = await GET(new Request("http://localhost/api/billing/recheck"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("req_test");
    expect(body.model.timeline).toEqual(timelineMock);
    expect(body.model.webhookHealth.status).toBe("healthy");
    expect(body.model.correlationV2).toBeDefined();
    expect(JSON.stringify(body.model.correlationV2)).not.toContain("http");
  });

  it("returns unauthorized when no user", async () => {
    mockUser = null;
    const res = await GET(new Request("http://localhost/api/billing/recheck"));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    mockUser = { id: "user-1", email: "user@example.com" };
  });

  it("returns structured error when refresh fails", async () => {
    creditsMock.mockRejectedValueOnce(new Error("fail"));
    const res = await GET(new Request("http://localhost/api/billing/recheck"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.error?.code).toBe("RECHECK_FAILED");
  });
});
