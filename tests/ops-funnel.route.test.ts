/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let rlAllowed = true;
let role = "admin";
let computeFunnelSummaryMock: any;

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
    withRequestIdHeaders: (h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders(h as any);
      headers.set("x-request-id", "req_test");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_test" };
    },
    applyRequestIdHeaders: (res: any, requestId: string, opts?: { noStore?: boolean; retryAfterSeconds?: number }) => {
      res.headers.set("x-request-id", requestId);
      if (opts?.noStore ?? true) res.headers.set("cache-control", "no-store");
      if (opts?.retryAfterSeconds) res.headers.set("retry-after", `${opts.retryAfterSeconds}`);
      return res;
    },
    jsonError: ({ code, message, requestId, status = 500, meta }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId, "cache-control": "no-store" }),
      json: async () => ({ error: { code, message, requestId, meta } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" }, supabase: {} }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn(async () => ({ role })),
    isOpsRole: (r: string) => r === "admin" || r === "ops" || r === "super_admin",
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rlAllowed, retryAfterSeconds: 5 }),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ budget: "medium", limit: 10, windowMs: 1000 }),
  }));
  computeFunnelSummaryMock = vi.fn(async () => ({
    windows: [
      {
        windowLabel: "24h",
        invited: 1,
        signed_up: 1,
        created_cv: 1,
        exported_cv: 0,
        created_application: 0,
        created_interview: 0,
        conversion: { invitedToSignup: 100, signupToCv: 100, cvToExport: 0, exportToApplication: 0 },
      },
    ],
    rulesVersion: "test",
  }));
  vi.doMock("@/lib/ops/funnel", () => ({
    computeFunnelSummary: computeFunnelSummaryMock,
  }));

  const route = await import("@/app/api/ops/funnel/route");
  GET = route.GET;
});

describe("ops funnel route", () => {
  it("returns funnel for ops", async () => {
    rlAllowed = true;
    role = "admin";
    const res = await GET(new Request("http://localhost/api/ops/funnel"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("rate limits", async () => {
    rlAllowed = false;
    const res = await GET(new Request("http://localhost/api/ops/funnel"));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.meta.limitKey).toBe("ops_funnel_get");
    rlAllowed = true;
  });

  it("forbids non ops", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/funnel"));
    expect(res.status).toBe(403);
    role = "admin";
  });

  it("handles groupBy source", async () => {
    const res = await GET(new Request("http://localhost/api/ops/funnel?groupBy=source"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(computeFunnelSummaryMock).toHaveBeenLastCalledWith({ supabase: {}, groupBySource: true });
  });
});
