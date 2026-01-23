/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
const inserts: Record<string, any[]> = { ops_alert_events: [], ops_audit_log: [] };

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
      this.method = init?.method ?? "POST";
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
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "admin" }),
    isOpsRole: () => true,
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true }),
  }));
  vi.doMock("@/lib/ops/ops-alerts-notify", () => ({
    notifyAlertTransitions: vi.fn().mockResolvedValue([]),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => ({
        insert: (payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload];
          inserts[table] = inserts[table] ?? [];
          inserts[table].push(...arr);
          return {
            select: () => ({
              single: async () => ({ data: { id: "evt-test" }, error: null }),
            }),
          };
        },
      }),
    }),
  }));

  const mod = await import("@/app/api/ops/alerts/test/route");
  POST = mod.POST;
});

describe("ops alerts test event route", () => {
  it("persists test event and dedupes repeated sends within window", async () => {
    inserts.ops_alert_events = [];
    inserts.ops_audit_log = [];
    const first = await POST(new Request("http://localhost/api/ops/alerts/test"));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(firstBody.eventId).toBe("evt-test");
    const event = inserts.ops_alert_events[0];
    expect(event.signals_masked.is_test).toBe(true);
    expect(event.window_label).toBe("test");

    const second = await POST(new Request("http://localhost/api/ops/alerts/test"));
    const secondBody = await second.json();
    expect(secondBody.deduped).toBe(true);
    expect(secondBody.eventId).toBe("evt-test");
    expect(inserts.ops_alert_events.length).toBe(1);
  });
});
