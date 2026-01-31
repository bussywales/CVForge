/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let role = "support";
let rateAllowed = true;
let inserted: any = null;

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
      headers.set("x-request-id", "req_ev");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_ev" };
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

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: async () => undefined,
  }));

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({}),
  }));

  vi.doMock("@/lib/ops/ops-audit-log", () => ({
    insertOpsAuditLog: async () => undefined,
  }));

  vi.doMock("@/lib/ops/ops-case-audit", () => ({
    insertCaseAudit: async () => null,
  }));

  vi.doMock("@/lib/ops/ops-case-queue-store", () => ({
    upsertCaseQueueSource: async () => null,
  }));

  vi.doMock("@/lib/ops/ops-case-evidence", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ops/ops-case-evidence")>("@/lib/ops/ops-case-evidence");
    return {
      ...actual,
      insertCaseEvidence: async (input: any) => {
        inserted = input;
        return {
          id: "ev_1",
          request_id: input.requestId,
          type: input.type,
          body: input.body,
          meta: input.meta ?? null,
          created_by_user_id: input.actorUserId ?? "user_ops",
          created_at: "2024-01-01T00:00:00.000Z",
        };
      },
    };
  });

  vi.doMock("@/lib/ops/ops-case-workflow", () => ({
    getOrCreateCaseWorkflow: async () => ({ request_id: "req_case" }),
    touchCaseWorkflow: async () => null,
  }));

  const mod = await import("@/app/api/ops/case/evidence/route");
  POST = mod.POST;
});

describe("ops case evidence route", () => {
  it("forbids non-ops", async () => {
    role = "user";
    const res = await POST(
      new Request("http://localhost/api/ops/case/evidence", {
        method: "POST",
        body: JSON.stringify({ requestId: "req_case", type: "note", body: "hello" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("sanitises body and meta", async () => {
    role = "support";
    inserted = null;
    const res = await POST(
      new Request("http://localhost/api/ops/case/evidence", {
        method: "POST",
        body: JSON.stringify({
          requestId: "req_case",
          type: "note",
          body: "Contact test@example.com for details.",
          meta: { scenarioId: "scenario_123456789" },
        }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(inserted.body).toContain("[email-redacted]");
    expect(inserted.meta.scenarioId).toBe("scenario");
    expect(body.evidence.meta.scenarioId).toBe("scenario");
  });
});
