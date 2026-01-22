/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let role = "admin";
let allowed = true;

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
    getUserRole: vi.fn().mockResolvedValue({ role }),
    isOpsRole: () => role === "admin",
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: vi.fn(() => (allowed ? { allowed: true, remaining: 1 } : { allowed: false, retryAfterSeconds: 12, status: 429 })),
  }));
  vi.doMock("@/lib/ops/rag-status", () => ({
    buildRagStatus: vi.fn().mockResolvedValue({
      rulesVersion: "rag_v2_15m_trend",
      window: { minutes: 15, fromIso: "2024-02-10T11:45:00.000Z", toIso: "2024-02-10T12:00:00.000Z" },
      status: "amber",
      overall: "amber",
      headline: "Webhook failures (2) in last 15m",
      signals: [],
      topIssues: [],
      topRepeats: { requestIds: [], codes: [], surfaces: [] },
      trend: { bucketMinutes: 15, fromIso: "2024-02-09T12:00:00.000Z", toIso: "2024-02-10T12:00:00.000Z", buckets: [], direction: "stable" },
      updatedAt: "2024-02-10T12:00:00.000Z",
    }),
  }));

  const route = await import("@/app/api/ops/rag-status/route");
  GET = route.GET;
});

describe("ops rag status route", () => {
  it("returns rag model with headers", async () => {
    role = "admin";
    allowed = true;
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    const body = await res.json();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.rag.rulesVersion).toBe("rag_v2_15m_trend");
    expect(body.rag.window.minutes).toBe(15);
  });

  it("blocks non-ops roles", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    expect(res.status).toBe(403);
  });

  it("returns retry-after when limited", async () => {
    role = "admin";
    allowed = false;
    const res = await GET(new Request("http://localhost/api/ops/rag-status"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
  });
});
