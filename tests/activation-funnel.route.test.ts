import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let GET: any;
let role = "admin";
let rows: any[] = [];

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
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
    makeRequestId: () => "req_test",
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops1", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockImplementation(async () => ({ role })),
    isOpsRole: (r: string) => r === "admin" || r === "super_admin" || r === "ops",
    requireOpsAccess: async () => true,
  }));

  const builder: any = {
    select() {
      return this;
    },
    gte() {
      return this;
    },
    in() {
      return Promise.resolve({ data: rows, error: null });
    },
  };

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => builder,
    }),
  }));

  ({ GET } = await import("@/app/api/ops/activation-funnel/route"));
});

beforeEach(() => {
  rows = [];
  role = "admin";
});

describe("ops activation funnel route", () => {
  it("returns aggregated counts", async () => {
    rows = [
      { type: "monetisation.activation_view", body: null, occurred_at: "2024-01-01T00:00:00.000Z" },
      { type: "monetisation.activation_step_click", body: JSON.stringify({ stepId: "first_outreach" }) },
      { type: "monetisation.activation_cta_click", body: JSON.stringify({ ctaId: "primary" }) },
      { type: "monetisation.activation_model_error", body: JSON.stringify({ code: "ERR" }) },
      { type: "monetisation.activation_first_application", body: null },
    ];
    const res = await GET(new Request("http://localhost/api/ops/activation-funnel?range=7d"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.counts.activation_view).toBe(1);
    expect(body.stepClicks.first_outreach).toBe(1);
    expect(body.ctaClicks.primary).toBe(1);
    expect(body.counts.activation_model_error.ERR).toBe(1);
    expect(body.milestones.first_application).toBe(1);
  });

  it("rejects invalid range", async () => {
    const res = await GET(new Request("http://localhost/api/ops/activation-funnel?range=bad"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.requestId).toBe("req_test");
  });

  it("rejects non-ops users", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/activation-funnel"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
