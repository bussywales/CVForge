/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from "vitest";

let POST: any;

describe("ops alerts ack token ttl", () => {
  beforeEach(async () => {
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
        return this.body ? JSON.parse(this.body) : {};
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
        headers.set("x-request-id", "req_token");
        if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
        return { headers, requestId: "req_token" };
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
      getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: () => ({ allowed: true }),
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceRoleClient: () => ({
        from: () => ({
          select: () => ({
            eq: (_field: string, _value: any) => ({
              limit: () => ({
                single: () => ({ data: { id: "evt_token", window_label: "15m" }, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({}),
        }),
      }),
    }));
    vi.doMock("@/lib/monetisation", () => ({
      logMonetisationEvent: vi.fn(),
    }));

    process.env.ALERTS_ACK_SECRET = "secret";

    const mod = await import("@/app/api/ops/alerts/ack-token/route");
    POST = mod.POST;
  });

  const send = async () => {
    const res = await POST(new Request("http://localhost/api/ops/alerts/ack-token", { method: "POST", body: JSON.stringify({ eventId: "evt_token" }) }) as any);
    return res.json();
  };

  it("defaults to 900s when unset", async () => {
    delete process.env.ALERTS_ACK_TTL_SECONDS;
    const body = await send();
    expect(body.ttlSeconds).toBe(900);
  });

  it("clamps invalid to 900", async () => {
    process.env.ALERTS_ACK_TTL_SECONDS = "not-a-number";
    const body = await send();
    expect(body.ttlSeconds).toBe(900);
  });

  it("clamps low to 600", async () => {
    process.env.ALERTS_ACK_TTL_SECONDS = "100";
    const body = await send();
    expect(body.ttlSeconds).toBe(600);
  });

  it("clamps high to 1800", async () => {
    process.env.ALERTS_ACK_TTL_SECONDS = "5000";
    const body = await send();
    expect(body.ttlSeconds).toBe(1800);
  });

  it("accepts valid ttl", async () => {
    process.env.ALERTS_ACK_TTL_SECONDS = "1200";
    const body = await send();
    expect(body.ttlSeconds).toBe(1200);
  });
});
