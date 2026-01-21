/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let POST: any;
let getUserMock: any;
let roleMock: any;

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
    withRequestIdHeaders: (h?: HeadersInit) => {
      const headers = new SimpleHeaders(h as any);
      headers.set("x-request-id", "req_test");
      return { headers, requestId: "req_test" };
    },
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => {
    getUserMock = vi.fn().mockResolvedValue({ user: { id: "ops-user", email: "ops@example.com" } });
    return { getSupabaseUser: getUserMock };
  });
  vi.doMock("@/lib/rbac", () => {
    roleMock = vi.fn().mockResolvedValue({ role: "admin" });
    return { getUserRole: roleMock, isOpsRole: () => true };
  });
  const baseRow = {
    id: "row_1",
    body: JSON.stringify({ code: "PORTAL_RETRY_SUCCESS", requestId: "req_1" }),
    occurred_at: "2024-02-10T08:00:00.000Z",
    created_at: "2024-02-10T08:00:00.000Z",
  };
  const builder: any = {
    eq: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    lt: () => builder,
    select: () => builder,
    update: (payload: any) => {
      if (payload?.body) builder.body = payload.body;
      return builder;
    },
    single: async () => {
      if (builder.body) baseRow.body = builder.body;
      return { data: { ...baseRow }, error: null };
    },
    then: (resolve: any, reject: any) => Promise.resolve({ data: [baseRow], error: null }).then(resolve, reject),
  };
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => builder,
    }),
  }));

  const route = await import("@/app/api/ops/resolution-effectiveness/route");
  GET = route.GET;
  POST = route.POST;
});

describe("ops resolution effectiveness route", () => {
  it("rejects invalid payload", async () => {
    const res = await POST(new Request("http://localhost/api/ops/resolution-effectiveness", { method: "POST", body: JSON.stringify({ state: "success" }) }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("MISSING_OUTCOME");
  });

  it("enforces auth", async () => {
    getUserMock.mockResolvedValueOnce({ user: null });
    const res = await GET(new Request("http://localhost/api/ops/resolution-effectiveness"));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns due items with headers", async () => {
    const res = await GET(new Request("http://localhost/api/ops/resolution-effectiveness?due=1"));
    const body = await res.json();
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.items.length).toBe(1);
  });

  it("saves effectiveness for ops user", async () => {
    const res = await POST(
      new Request("http://localhost/api/ops/resolution-effectiveness", {
        method: "POST",
        body: JSON.stringify({ resolutionOutcomeId: "row_1", state: "success", reason: "unblocked" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.item.id).toBe("row_1");
  });
});
