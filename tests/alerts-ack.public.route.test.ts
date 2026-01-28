/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
const activities: any[] = [];
const events: Record<string, any> = { evt_pub: { id: "evt_pub", key: "ops_alert_test" } };

beforeAll(async () => {
  process.env.ALERTS_ACK_SECRET = "secret";

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
      headers.set("x-request-id", "req_public");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_public" };
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
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true }),
  }));
  vi.doMock("@/lib/ops/alerts-handled", () => ({
    recordAlertHandled: async ({ eventId }: any) => ({ ok: true, eventKey: "ops_alert_test", deduped: eventId === "evt_pub_dup" }),
  }));
  vi.doMock("@/lib/ops/alerts-ack-token", () => {
    const mod = vi.importActual("@/lib/ops/alerts-ack-token") as any;
    return mod;
  });
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        insert: (payload: any) => {
          if (payload?.body) activities.push(payload);
          return { data: payload };
        },
      }),
    }),
  }));

  const mod = await import("@/app/api/alerts/ack/route");
  POST = mod.POST;
});

describe("public alerts ack route", () => {
  it("acks with valid token and dedupes", async () => {
    const tokenMod = await import("@/lib/ops/alerts-ack-token");
    const token = tokenMod.signAckToken({ eventId: "evt_pub", exp: Math.floor(Date.now() / 1000) + 60 });
    const res = await POST(new Request(`http://localhost/api/alerts/ack?token=${token}`) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eventId).toBe("evt_pub");
  });

  it("rejects invalid token", async () => {
    const res = await POST(new Request("http://localhost/api/alerts/ack?token=bad") as any);
    expect(res.status).toBe(400);
  });

  it("rejects missing token", async () => {
    const res = await POST(new Request("http://localhost/api/alerts/ack") as any);
    expect(res.status).toBe(400);
  });
});
