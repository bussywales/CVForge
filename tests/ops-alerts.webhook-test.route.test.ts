/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let role = "admin";
let rateAllowed = true;
const inserts: Record<string, any[]> = { ops_alert_events: [] };

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
    getUserRole: async () => ({ role }),
    isOpsRole: (r: string) => r === "admin" || r === "ops" || r === "super_admin",
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 15 }),
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
              single: async () => ({ data: { id: "evt-webhook" }, error: null }),
            }),
          };
        },
      }),
    }),
  }));

  const mod = await import("@/app/api/ops/alerts/webhook-test/route");
  POST = mod.POST;
});

describe("ops alerts webhook-test route", () => {
  it("forbids non-ops", async () => {
    role = "user";
    rateAllowed = true;
    const res = await POST(new Request("http://localhost/api/ops/alerts/webhook-test"));
    expect(res.status).toBe(403);
  });

  it("returns error when webhook config missing", async () => {
    role = "admin";
    rateAllowed = true;
    process.env.OPS_ALERT_WEBHOOK_URL = "";
    process.env.OPS_ALERT_WEBHOOK_SECRET = "";
    const res = await POST(new Request("http://localhost/api/ops/alerts/webhook-test"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("WEBHOOK_NOT_CONFIGURED");
  });

  it("persists test event and returns eventId", async () => {
    role = "admin";
    rateAllowed = true;
    inserts.ops_alert_events = [];
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.com/webhook";
    process.env.OPS_ALERT_WEBHOOK_SECRET = "secret";
    const res = await POST(new Request("http://localhost/api/ops/alerts/webhook-test"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.eventId).toBe("evt-webhook");
    expect(inserts.ops_alert_events[0].key).toBe("ops_alert_webhook_test");
  });

  it("rate limits", async () => {
    role = "admin";
    rateAllowed = false;
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.com/webhook";
    process.env.OPS_ALERT_WEBHOOK_SECRET = "secret";
    const res = await POST(new Request("http://localhost/api/ops/alerts/webhook-test"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("15");
  });
});
