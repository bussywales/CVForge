/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let GET: any;
let addWatchMock: any;
let listWatchMock: any;

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
    body: any;
    headers: SimpleHeaders;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.body = init?.body ?? "";
      this.headers = new SimpleHeaders(init?.headers ?? {});
    }
    async json() {
      return JSON.parse(this.body);
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
  addWatchMock = vi.fn().mockResolvedValue({ expiresAt: "2024-02-11T00:00:00.000Z" });
  listWatchMock = vi.fn().mockResolvedValue([{ requestId: "req1", reasonCode: "delay", expiresAt: "2024-02-11T00:00:00.000Z", createdAt: "2024-02-10" }]);
  vi.doMock("@/lib/ops/ops-watch", () => ({
    addWatch: addWatchMock,
    listWatch: listWatchMock,
  }));

  const route = await import("@/app/api/ops/watch/route");
  POST = route.POST;
  GET = route.GET;
});

describe("ops watch route", () => {
  it("validates requestId", async () => {
    const res = await POST(new Request("http://localhost", { body: JSON.stringify({ reasonCode: "delay" }) }));
    expect(res.status).toBe(400);
  });

  it("creates watch", async () => {
    const res = await POST(
      new Request("http://localhost", { body: JSON.stringify({ requestId: "req1", reasonCode: "delay", ttlHours: 24 }), headers: { "Content-Type": "application/json" } })
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(addWatchMock).toHaveBeenCalled();
  });

  it("lists watch records", async () => {
    const res = await GET(new Request("http://localhost"));
    const body = await res.json();
    expect(body.records.length).toBe(1);
  });
});
