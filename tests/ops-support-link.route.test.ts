import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;

beforeAll(async () => {
  class SimpleHeaders {
    private store: Record<string, string> = {};
    constructor(init?: Record<string, string>) {
      Object.entries(init ?? {}).forEach(([k, v]) => this.store[k.toLowerCase()] = v);
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
        text: async () => JSON.stringify(body),
      }),
    },
  }));

  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "u1", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "admin" }),
    isOpsRole: () => true,
  }));

  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        insert,
      }),
    }),
  }));

  const mod = await import("@/app/api/ops/support-link/route");
  POST = mod.POST;
});

describe("ops support-link route", () => {
  it("returns valid json with full url for subscription", async () => {
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "billing_subscription_80" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.trim().endsWith("}")).toBe(true);
    const parsed = JSON.parse(text);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.url).toBe("string");
    expect(parsed.url).toContain("from=ops_support");
    expect(parsed.url).toContain("support=1");
    expect(parsed.url).toContain("plan=monthly_80");
  });

  it("returns structured error for invalid kind", async () => {
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "bad_kind" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.error?.code).toBe("INVALID_PAYLOAD");
  });
});
