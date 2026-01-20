import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let fetchSettings: any;
let stripeClient: any;

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
      this.body = init?.body ?? "";
      this.headers = new SimpleHeaders(init?.headers ?? {});
    }
    async json() {
      return JSON.parse(this.body);
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
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockResolvedValue({ role: "admin" }),
    isAdminRole: (role: string) => role === "admin" || role === "super_admin",
  }));

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "user@example.com" } } }),
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ data: null, error: null }),
            limit: () => ({ data: [], error: null }),
            ilike: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  }));

  const creditsMock = vi.fn().mockResolvedValue(5);
  const ledgerMock = vi.fn().mockResolvedValue([]);
  vi.doMock("@/lib/data/credits", () => ({
    getUserCredits: creditsMock,
    listCreditActivity: ledgerMock,
  }));

  fetchSettings = vi.fn().mockResolvedValue({
    user_id: "target-user",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "none",
    subscription_plan: null,
    auto_topup_enabled: false,
    auto_topup_pack_key: null,
    auto_topup_threshold: 3,
    created_at: "",
    updated_at: "",
  });
  vi.doMock("@/lib/data/billing", () => ({
    fetchBillingSettings: fetchSettings,
  }));

  stripeClient = {
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    invoices: {
      retrieve: vi.fn(),
    },
  };
  vi.doMock("@/lib/stripe/stripe", () => ({
    getStripeClient: () => stripeClient,
  }));

  const mod = await import("@/app/api/ops/billing/snapshot/route");
  GET = mod.GET;
});

describe("ops billing snapshot route", () => {
  it("rejects missing userId", async () => {
    const req = new Request("http://localhost/api/ops/billing/snapshot", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("INVALID_USER");
  });

  it("returns ok response when no customer exists", async () => {
    const req = new Request("http://localhost/api/ops/billing/snapshot?userId=123456", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stripe.hasCustomer).toBe(false);
    expect(body.local.subscriptionStatus).toBeDefined();
  });

  it("returns structured error on stripe failure", async () => {
    fetchSettings.mockResolvedValueOnce({
      user_id: "target-user",
      stripe_customer_id: "cus_test",
      stripe_subscription_id: null,
      subscription_status: "none",
      subscription_plan: null,
      auto_topup_enabled: false,
      auto_topup_pack_key: null,
      auto_topup_threshold: 3,
      created_at: "",
      updated_at: "",
    });
    stripeClient.subscriptions.list.mockRejectedValueOnce(new Error("stripe down"));
    const req = new Request("http://localhost/api/ops/billing/snapshot?userId=123456", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.error?.code).toBe("STRIPE_SNAPSHOT_FAILED");
  });

  it("forbids non-admin roles", async () => {
    const rbac = await import("@/lib/rbac");
    (rbac as any).getUserRole.mockResolvedValueOnce({ role: "user" });
    const req = new Request("http://localhost/api/ops/billing/snapshot?userId=123456", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
