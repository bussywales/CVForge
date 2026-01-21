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
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
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
  vi.doMock("@/lib/ops/ops-resolution-outcomes", () => ({
    summariseResolutionOutcomes: vi.fn().mockResolvedValue({
      totals: { count: 1, uniqueUsers: 1, uniqueRequestIds: 1 },
      topOutcomes: [{ code: "PORTAL_RETRY_SUCCESS", count: 1 }],
      topActors: [{ actorMasked: "o***@example.com", count: 1 }],
      bySurface: [{ surface: "billing", count: 1 }],
      recent: [{ at: "2024-02-10", code: "PORTAL_RETRY_SUCCESS" }],
    }),
  }));

  const route = await import("@/app/api/ops/resolution-outcomes/summary/route");
  GET = route.GET;
});

describe("ops resolution summary route", () => {
  it("returns summary", async () => {
    const res = await GET(new Request("http://localhost"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.totals.count).toBe(1);
  });
});
