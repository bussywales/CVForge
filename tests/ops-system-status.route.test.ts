/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;

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
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockResolvedValue({ role: "admin" }),
    isOpsRole: () => true,
  }));
  vi.doMock("@/lib/ops/system-status", () => ({
    buildSystemStatus: vi.fn().mockResolvedValue({
      deployment: { vercelId: "v1", matchedPath: "/api" },
      now: "2024-02-10T12:00:00.000Z",
      rag: {
        rulesVersion: "rag_v1",
        window: { minutes: 15, fromIso: "2024-02-10T11:45:00.000Z", toIso: "2024-02-10T12:00:00.000Z" },
        overall: "green",
        signals: {
          webhookFailures15m: { count: 0, state: "green" },
          webhookErrors15m: { count: 0, state: "green" },
          portalErrors15m: { count: 0, state: "green" },
          checkoutErrors15m: { count: 0, state: "green" },
          rateLimits15m: { count: 0, state: "green" },
        },
        topIssues: [],
        updatedAt: "2024-02-10T12:00:00.000Z",
      },
      health: {
        billingRecheck429_24h: 1,
        portalErrors_24h: 0,
        webhookFailures_24h: 2,
        webhookRepeats_24h: 1,
        incidents_24h: 5,
        audits_24h: 3,
      },
      queues: { webhookFailuresQueue: { count24h: 2, lastSeenAt: "2024-02-10T11:00:00.000Z", repeatsTop: 2 } },
      limits: { rateLimitHits24h: { billing_recheck: 0, monetisation_log: 0, ops_actions: 0 }, topLimitedRoutes24h: [], approx: true },
      notes: [],
    }),
  }));

  const route = await import("@/app/api/ops/system-status/route");
  GET = route.GET;
});

describe("ops system status route", () => {
  it("returns status with no-store", async () => {
    const res = await GET(new Request("http://localhost/api/ops/system-status"));
    const body = await res.json();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.status.health.incidents_24h).toBe(5);
    expect(body.status.rag.overall).toBe("green");
    expect(body.status.rag.window.minutes).toBe(15);
  });
});
