/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let GRANT: any;
let REVOKE: any;
let role = "admin";
let decision = { allowed: true, reason: "db_allowlist", allowlistMeta: { source: "db" } };

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
    body: any;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
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
      headers.set("x-request-id", "req_test");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_test" };
    },
    applyRequestIdHeaders: (res: any, requestId: string, opts?: { noStore?: boolean; retryAfterSeconds?: number }) => {
      res.headers.set("x-request-id", requestId);
      if (opts?.noStore ?? true) res.headers.set("cache-control", "no-store");
      if (opts?.retryAfterSeconds) res.headers.set("retry-after", `${opts.retryAfterSeconds}`);
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
    getUserRole: vi.fn().mockImplementation(async () => ({ role })),
    isOpsRole: (r: string) => r === "admin" || r === "ops" || r === "super_admin",
    requireOpsAccess: vi.fn().mockResolvedValue(true),
  }));
  vi.doMock("@/lib/early-access", () => ({
    getEarlyAccessDecision: vi.fn(async () => decision),
    getEarlyAccessRecord: vi.fn(async () => ({ granted_at: "2024-01-01T00:00:00.000Z", revoked_at: null, note: "hi" })),
    grantEarlyAccess: vi.fn(async () => ({ granted_at: "2024-01-02T00:00:00.000Z", revoked_at: null, note: null })),
    revokeEarlyAccess: vi.fn(async () => ({ status: "revoked", revokedAt: "2024-01-03T00:00:00.000Z" })),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ budget: "test", limit: 5, windowMs: 1000 }),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "target@example.com" } } }),
        },
      },
      from: () => ({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }));

  const accessRoute = await import("@/app/api/ops/access/route");
  const grantRoute = await import("@/app/api/ops/access/grant/route");
  const revokeRoute = await import("@/app/api/ops/access/revoke/route");
  GET = accessRoute.GET;
  GRANT = grantRoute.POST;
  REVOKE = revokeRoute.POST;
});

describe("ops access routes", () => {
  it("forbids non-ops", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/access?userId=00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(403);
  });

  it("returns access decision", async () => {
    role = "admin";
    const res = await GET(new Request("http://localhost/api/ops/access?userId=00000000-0000-0000-0000-000000000000"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.reason).toBe("db_allowlist");
  });

  it("grants and revokes idempotently", async () => {
    const grantRes = await GRANT(new Request("http://localhost/api/ops/access/grant", { method: "POST", body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }) }));
    const grantBody = await grantRes.json();
    expect(grantRes.status).toBe(200);
    expect(grantBody.ok).toBe(true);

    const revokeRes = await REVOKE(new Request("http://localhost/api/ops/access/revoke", { method: "POST", body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }) }));
    const revokeBody = await revokeRes.json();
    expect(revokeBody.ok).toBe(true);
  });
});
