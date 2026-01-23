import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let logMock: any;

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
      this.method = init?.method ?? "POST";
      this.body = init?.body ?? "";
      this.headers = new SimpleHeaders(init?.headers ?? {});
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
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "admin" }),
    isOpsRole: () => true,
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({}),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true }),
  }));
  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));
  logMock = vi.fn().mockResolvedValue({
    id: "activity-1",
    body: JSON.stringify({ code: "alert_handled", alertKey: "ops_alert_test" }),
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    type: "monetisation.ops_resolution_outcome_set",
  });
  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: logMock,
  }));
  vi.doMock("@/lib/ops/ops-resolution-outcomes", () => ({
    buildOutcomeEvent: vi.fn().mockImplementation((input: any) => ({ surface: "ops", meta: { ...input.meta, code: input.code, requestId: input.requestId ?? null } })),
    mapOutcomeRows: vi.fn().mockImplementation((rows: any[]) =>
      rows.map((row) => ({
        code: "alert_handled",
        requestId: row?.meta?.requestId ?? null,
        createdAt: new Date().toISOString(),
        alertKey: row?.meta?.alertKey ?? null,
      }))
    ),
  }));

  const route = await import("@/app/api/ops/resolution-outcome/route");
  POST = route.POST;
});

describe("ops resolution outcome alert handled", () => {
  it("accepts alert_handled without requestId and stores meta", async () => {
    const res = await POST(
      new Request("http://localhost/api/ops/resolution-outcome", {
        method: "POST",
        body: JSON.stringify({ code: "alert_handled", meta: { alertKey: "ops_alert_test" } }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(logMock).toHaveBeenCalledWith(expect.anything(), "ops-user", "ops_resolution_outcome_set", expect.objectContaining({ meta: expect.objectContaining({ alertKey: "ops_alert_test" }) }));
  });
});
