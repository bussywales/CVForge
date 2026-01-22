/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let isOpsRoleMock: any;
let rateLimitMock: any;

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
    isOpsRole: (...args: any[]) => isOpsRoleMock(...args),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: (...args: any[]) => rateLimitMock(...args),
  }));
  vi.doMock("@/lib/ops/rag-status", () => ({
    buildRagStatus: vi.fn().mockResolvedValue({
      overall: "green",
      reasons: [],
      window: "15m",
      updatedAt: "2024-02-10T12:00:00.000Z",
      metrics: { portalErrors: 0, checkoutErrors: 0, webhookFailures: 0, webhookRepeats: 0, rateLimit429s: 0 },
    }),
  }));

  const route = await import("@/app/api/ops/rag-status/route");
  GET = route.GET;

  isOpsRoleMock = vi.fn().mockReturnValue(true);
  rateLimitMock = vi.fn().mockReturnValue({ allowed: true, remaining: 1 });
});

describe("ops rag status route", () => {
  it("returns rag with headers", async () => {
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    const body = await res.json();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(body.ok).toBe(true);
    expect(body.rag.overall).toBe("green");
  });

  it("returns 403 for non-ops", async () => {
    isOpsRoleMock.mockReturnValueOnce(false);
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 429 when limited", async () => {
    rateLimitMock.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 7, status: 429 });
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
  });
});
