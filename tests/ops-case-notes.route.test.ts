/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let POST: any;
let role = "support";
let rateAllowed = true;
let notesRow: any = null;
let upsertResult: any = null;

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
      headers.set("x-request-id", "req_notes");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_notes" };
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

  vi.doMock("@/lib/ops/ops-case-notes", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ops/ops-case-notes")>("@/lib/ops/ops-case-notes");
    return {
      ...actual,
      getCaseNotes: async () => notesRow,
      upsertCaseNotes: async () => upsertResult,
    };
  });

  const getMod = await import("@/app/api/ops/case/notes/route");
  GET = getMod.GET;
  const postMod = await import("@/app/api/ops/case/notes/upsert/route");
  POST = postMod.POST;
});

describe("ops case notes routes", () => {
  it("forbids non-ops on GET", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/case/notes?caseType=request&caseKey=req_1"));
    expect(res.status).toBe(403);
  });

  it("returns notes for ops", async () => {
    role = "support";
    notesRow = {
      case_type: "request",
      case_key: "req_1",
      window_label: "15m",
      checklist: {},
      outcome_code: null,
      notes: null,
      status: "open",
      last_handled_at: null,
      last_handled_by: null,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    };
    const res = await GET(new Request("http://localhost/api/ops/case/notes?caseType=request&caseKey=req_1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notes.caseKey).toBe("req_1");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("requires admin to close case", async () => {
    role = "support";
    upsertResult = { row: null, toggledKeys: [], changed: false };
    const res = await POST(
      new Request("http://localhost/api/ops/case/notes/upsert", {
        method: "POST",
        body: JSON.stringify({ caseType: "request", caseKey: "req_1", patch: { status: "closed" } }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns retry-after when rate limited", async () => {
    role = "admin";
    rateAllowed = false;
    const res = await GET(new Request("http://localhost/api/ops/case/notes?caseType=request&caseKey=req_1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    rateAllowed = true;
  });
});
