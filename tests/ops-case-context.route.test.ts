/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let POST: any;
let role = "admin";
let rateAllowed = true;
let contextRow: any = null;
let upsertArgs: any = null;
let listUsersMock: any;
let roleRow: any = { role: "user" };

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
      return JSON.parse(this.body ?? "{}");
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
    withRequestIdHeaders: (_?: HeadersInit, __?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders();
      headers.set("x-request-id", "req_ctx");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_ctx" };
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
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role }),
    isOpsRole: (r: string) => r !== "user",
    isAdminRole: (r: string) => r === "admin" || r === "super_admin",
  }));

  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 5 }),
  }));

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: async () => undefined,
  }));

  listUsersMock = vi.fn().mockResolvedValue({
    data: { users: [{ id: "user_email", email: "person@example.com" }], lastPage: 1 },
    error: null,
  });

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      auth: {
        admin: {
          listUsers: listUsersMock,
        },
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: table === "user_roles" ? roleRow : null, error: null }),
          }),
        }),
      }),
    }),
  }));

  vi.doMock("@/lib/ops/ops-audit-log", () => ({
    insertOpsAuditLog: async () => undefined,
  }));

  vi.doMock("@/lib/ops/ops-request-context", () => ({
    resolveRequestContext: async () => contextRow,
    upsertRequestContext: async (input: any) => {
      upsertArgs = input;
      return {
        request_id: input.requestId,
        user_id: input.userId ?? null,
        email_masked: input.email ? "pe***@example.com" : null,
        source: input.source ?? null,
        confidence: input.confidence ?? null,
        evidence: {},
        sources: [input.source],
        first_seen_at: "2024-01-01T00:00:00.000Z",
        last_seen_at: "2024-01-01T00:10:00.000Z",
        last_seen_path: input.path ?? null,
        meta: {},
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:10:00.000Z",
      };
    },
  }));

  const getMod = await import("@/app/api/ops/case/context/route");
  GET = getMod.GET;
  const postMod = await import("@/app/api/ops/case/context/attach/route");
  POST = postMod.POST;
});

describe("ops case context routes", () => {
  it("forbids non-ops on GET", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/case/context?requestId=req_1"));
    expect(res.status).toBe(403);
  });

  it("returns context for ops", async () => {
    role = "admin";
    contextRow = {
      request_id: "req_ctx",
      user_id: "user_1",
      email_masked: "us***@example.com",
      source: "ops_audit",
      confidence: "high",
      evidence: {},
      sources: ["ops_audit"],
      first_seen_at: "2024-01-01T00:00:00.000Z",
      last_seen_at: "2024-01-01T00:05:00.000Z",
      last_seen_path: "/api/ops/audits",
      meta: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:05:00.000Z",
    };
    const res = await GET(new Request("http://localhost/api/ops/case/context?requestId=req_ctx"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.context.userId).toBe("user_1");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("requires admin on attach", async () => {
    role = "support";
    const res = await POST(new Request("http://localhost/api/ops/case/context/attach", { method: "POST", body: JSON.stringify({ requestId: "req_ctx", email: "person@example.com" }) }));
    expect(res.status).toBe(403);
  });

  it("resolves email and returns masked context", async () => {
    role = "admin";
    upsertArgs = null;
    const res = await POST(
      new Request("http://localhost/api/ops/case/context/attach", { method: "POST", body: JSON.stringify({ requestId: "req_ctx", email: "person@example.com" }) })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.context.emailMasked).toBe("pe***@example.com");
    expect(upsertArgs.userId).toBe("user_email");
    expect(upsertArgs.source).toBe("manual_admin_attach");
    expect(upsertArgs.confidence).toBe("high");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
