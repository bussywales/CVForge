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
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
    }),
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createServerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            ilike: () => ({
              order: () => ({
                limit: () => ({ data: [{ type: "monetisation.webhook_received", occurred_at: "2024-02-10T10:00:00.000Z", body: JSON.stringify({ requestId: "req_1", eventId: "evt_1" }) }] }),
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
    buildBillingStatus: vi.fn().mockReturnValue({ subscriptionStatus: "none", lastBillingEvent: null }),
  }));
  vi.doMock("@/lib/billing/billing-timeline", () => ({
    buildBillingTimeline: vi.fn().mockReturnValue([]),
  }));
  vi.doMock("@/lib/billing/billing-credit-delay", () => ({
    detectCreditDelay: vi.fn().mockReturnValue({ state: "ok" }),
  }));
  vi.doMock("@/lib/webhook-health", () => ({
    computeWebhookHealth: vi.fn().mockReturnValue({ status: "healthy", window: { hours24: { ok: 1, error: 0 }, days7: { ok: 1, error: 0 } }, lastOkAt: null }),
  }));

  const route = await import("@/app/api/billing/recheck/route");
  GET = route.GET;
});

describe("billing recheck webhook status v2", () => {
  it("includes webhook status v2 in response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-10T12:00:00.000Z"));
    const res = await GET(new Request("http://localhost/api/billing/recheck"));
    const body = await res.json();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.model.webhookStatusV2).toBeDefined();
    expect(body.model.webhookStatusV2.state).toBeDefined();
    vi.useRealTimers();
  });
});
