/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let AUDIT_GET: any;
let role = "support";
let rateAllowed = true;

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
      headers.set("x-request-id", "req_audit");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_audit" };
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
    getSupabaseUser: async () => ({ user: { id: "user_ops", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role }),
    isOpsRole: (r: string) => r !== "user",
  }));

  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 7 }),
  }));

  vi.doMock("@/lib/ops/ops-case-audit", () => ({
    listCaseAudit: async () => [
      {
        id: "audit_1",
        created_at: "2024-01-01T00:00:00.000Z",
        actor_user_id: "user_ops",
        request_id: "req_audit",
        action: "CLAIM",
        meta: { status: "open" },
      },
    ],
  }));

  const auditMod = await import("@/app/api/ops/case/audit/route");
  AUDIT_GET = auditMod.GET;
});

describe("ops case audit route", () => {
  it("forbids non-ops", async () => {
    role = "user";
    const res = await AUDIT_GET(new Request("http://localhost/api/ops/case/audit?requestId=req_audit"));
    expect(res.status).toBe(403);
  });

  it("returns audit items for ops", async () => {
    role = "support";
    const res = await AUDIT_GET(new Request("http://localhost/api/ops/case/audit?requestId=req_audit"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items.length).toBe(1);
    expect(body.items[0].action).toBe("CLAIM");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
