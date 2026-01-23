/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
const activities: any[] = [];
const events: Record<string, any> = { evt_1: { id: "evt_1", key: "ops_alert_test" } };

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
    body: any;
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
      }),
    },
  }));
  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: (h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders(h as any);
      headers.set("x-request-id", "req_ack");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_ack" };
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
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "admin" }),
    isOpsRole: () => true,
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true }),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => ({
        select: (_fields: string) => ({
          eq: (field: string, value: any) => ({
            gte: (_field: string, _val: string) => ({
              like: (_likeField: string, likeVal: string) => ({
                limit: () => ({
                  data: activities.filter((a) => (field === "type" ? a.type === value : true)).filter((a) => (likeVal ? a.body.includes(likeVal.replace(/%/g, "")) : true)),
                  error: null,
                }),
              }),
            }),
            limit: (_?: number) => ({
              single: () => ({ data: events[value] ?? null, error: null }),
            }),
          }),
          limit: () => ({ data: [], error: null }),
        }),
        insert: (payload: any) => {
          if (table === "application_activities") activities.push(payload);
          return { data: payload };
        },
      }),
    }),
  }));

  const mod = await import("@/app/api/ops/alerts/ack/route");
  POST = mod.POST;
});

describe("ops alerts ack route", () => {
  it("acks an event and dedupes repeated acks", async () => {
    const req = new Request("http://localhost/api/ops/alerts/ack", { method: "POST", body: JSON.stringify({ eventId: "evt_1", source: "slack" }) });
    const res = await POST(req as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.eventId).toBe("evt_1");

    const res2 = await POST(req as any);
    const body2 = await res2.json();
    expect(body2.deduped).toBe(true);
  });

  it("returns bad request on missing eventId", async () => {
    const res = await POST(new Request("http://localhost/api/ops/alerts/ack", { method: "POST", body: "{}" }) as any);
    expect(res.status).toBe(400);
  });
});
