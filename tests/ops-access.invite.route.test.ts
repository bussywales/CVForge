/// <reference types="vitest/globals" />
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let POST_INVITE: any;
let POST_REVOKE: any;
const auditInsert = vi.fn();
const createInviteMock = vi.fn();
const revokeInviteMock = vi.fn();
let rlAllowed = true;
let role = "admin";

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
      this.method = init?.method ?? "POST";
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
    jsonError: ({ code, message, requestId, status = 500, meta }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId, "cache-control": "no-store" }),
      json: async () => ({ error: { code, message, requestId, meta } }),
      text: async () => JSON.stringify({ error: { code, message, requestId, meta } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn(async () => ({ role })),
    isOpsRole: (r: string) => r === "admin" || r === "super_admin" || r === "ops",
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rlAllowed, retryAfterSeconds: 5 }),
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 1000, budget: "medium" }),
  }));
  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: vi.fn(async () => null),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        insert: auditInsert,
      }),
    }),
  }));
  vi.doMock("@/lib/early-access", () => ({
    hashEarlyAccessEmail: (email: string) => `hash_${email}`,
  }));
  vi.doMock("@/lib/early-access/invites", () => ({
    createInvite: createInviteMock,
    revokeInvite: revokeInviteMock,
    buildInviteLink: (token: string) => `https://invite.test/${token}`,
  }));

  const inviteRoute = await import("@/app/api/ops/access/invite/route");
  POST_INVITE = inviteRoute.POST;
  const revokeRoute = await import("@/app/api/ops/access/invite/revoke/route");
  POST_REVOKE = revokeRoute.POST;
});

describe("ops access invite routes", () => {
  beforeEach(() => {
    rlAllowed = true;
    role = "admin";
    createInviteMock.mockResolvedValue({
      token: "tok123",
      invite: { invited_at: "2024-01-01T00:00:00.000Z", claimed_at: null, revoked_at: null, expires_at: null, token: "tok123" },
    });
    revokeInviteMock.mockResolvedValue({});
  });

  it("creates an invite for ops user", async () => {
    const res = await POST_INVITE(new Request("http://localhost", { body: JSON.stringify({ email: "new@example.com" }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.token).toBe("tok123");
  });

  it("rate limits invite creation", async () => {
    rlAllowed = false;
    const res = await POST_INVITE(new Request("http://localhost", { body: JSON.stringify({ email: "new@example.com" }) }));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.meta.retryAfterSeconds).toBe(5);
  });

  it("revokes invite", async () => {
    const res = await POST_REVOKE(new Request("http://localhost", { body: JSON.stringify({ email: "new@example.com" }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("blocks non-ops", async () => {
    role = "user";
    const res = await POST_INVITE(new Request("http://localhost", { body: JSON.stringify({ email: "new@example.com" }) }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
