import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let stripeCreate: any;

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
      redirect: (url: string, init?: { status?: number; headers?: Headers }) => ({
        status: init?.status ?? 303,
        headers: init?.headers ?? new SimpleHeaders({ location: url }),
        url,
      }),
      json: (body: any, init?: { status?: number; headers?: Headers }) => ({
        status: init?.status ?? 200,
        headers: init?.headers ?? new SimpleHeaders(),
        json: async () => body,
        text: async () => JSON.stringify(body),
      }),
    },
  }));

  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { stripe_customer_id: "cus_123" }, error: null }),
            }),
          }),
        }),
      },
      user: { id: "u1", email: "user@example.com" },
    }),
  }));

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: vi.fn().mockResolvedValue(null),
  }));

  stripeCreate = vi.fn().mockResolvedValue({ url: "https://stripe.test/portal" });
  vi.doMock("@/lib/stripe/stripe", () => ({
    getStripeClient: () => ({
      billingPortal: { sessions: { create: stripeCreate } },
    }),
  }));

  const mod = await import("@/app/api/billing/portal/route");
  GET = mod.GET;
});

describe("billing portal route", () => {
  it("redirects to stripe portal on success", async () => {
    const res = await GET(new Request("http://localhost/api/billing/portal?flow=manage"));
    expect(res.status).toBe(303);
    expect((res.headers as any).get("location")).toContain("stripe.test/portal");
  });

  it("redirects back to billing with error when stripe fails", async () => {
    stripeCreate.mockRejectedValueOnce(new Error("fail"));
    const res = await GET(new Request("http://localhost/api/billing/portal?flow=manage"));
    expect(res.status).toBe(303);
    const location = (res.headers as any).get("location");
    expect(location).toContain("/app/billing");
    expect(location).toContain("portal_error=1");
    expect(location).toContain("req=req_test");
    expect((res.headers as any).get("x-request-id")).toBe("req_test");
  });

  it("returns json error when format=json requested", async () => {
    stripeCreate.mockRejectedValueOnce(new Error("fail"));
    const res = await GET(
      new Request("http://localhost/api/billing/portal?flow=manage&format=json", {
        headers: { accept: "application/json" },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error?.code).toBe("PORTAL_ERROR");
    expect(body.error?.requestId).toBe("req_test");
  });
});
