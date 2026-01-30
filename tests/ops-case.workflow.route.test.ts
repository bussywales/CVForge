/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let CASE_GET: any;
let CLAIM_POST: any;
let STATUS_POST: any;
let ASSIGN_POST: any;
let role = "support";
let rateAllowed = true;
let claimConflict = false;

const workflowRow = {
  request_id: "req_case",
  status: "open",
  priority: "medium",
  assigned_to_user_id: null,
  claimed_at: null,
  resolved_at: null,
  closed_at: null,
  last_touched_at: "2024-01-01T00:00:00.000Z",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const conflictRow = {
  ...workflowRow,
  assigned_to_user_id: "user_other",
  claimed_at: "2024-01-01T00:10:00.000Z",
};

let evidenceRows = [
  {
    id: "ev_1",
    request_id: "req_case",
    type: "note",
    body: "First",
    meta: null,
    created_by_user_id: "user_ops",
    created_at: "2024-01-01T00:00:01.000Z",
  },
  {
    id: "ev_2",
    request_id: "req_case",
    type: "decision",
    body: "Second",
    meta: null,
    created_by_user_id: "user_ops",
    created_at: "2024-01-01T00:00:02.000Z",
  },
];

const contextRow = {
  request_id: "req_case",
  user_id: "user_ctx",
  email_masked: "us***@example.com",
  source: "ops_audit",
  confidence: "high",
  evidence: {},
  sources: ["ops_audit"],
  first_seen_at: "2024-01-01T00:00:00.000Z",
  last_seen_at: "2024-01-01T00:05:00.000Z",
  last_seen_path: "/app/ops/alerts",
  meta: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:05:00.000Z",
};

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
      headers.set("x-request-id", "req_case");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_case" };
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

  vi.doMock("@/lib/ops/ops-case-evidence", () => ({
    listCaseEvidence: async () => evidenceRows,
  }));

  vi.doMock("@/lib/ops/ops-request-context", () => ({
    resolveRequestContext: async () => contextRow,
  }));

  vi.doMock("@/lib/ops/ops-case-workflow", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ops/ops-case-workflow")>("@/lib/ops/ops-case-workflow");
    return {
      ...actual,
      getOrCreateCaseWorkflow: async () => workflowRow,
      getCaseWorkflow: async () => (claimConflict ? conflictRow : workflowRow),
      claimCaseWorkflow: async () => ({ row: claimConflict ? conflictRow : workflowRow, conflict: claimConflict }),
      updateCaseStatus: async () => workflowRow,
      assignCaseWorkflow: async () => workflowRow,
    };
  });

  const caseMod = await import("@/app/api/ops/case/route");
  CASE_GET = caseMod.GET;
  const claimMod = await import("@/app/api/ops/case/claim/route");
  CLAIM_POST = claimMod.POST;
  const statusMod = await import("@/app/api/ops/case/status/route");
  STATUS_POST = statusMod.POST;
  const assignMod = await import("@/app/api/ops/case/assign/route");
  ASSIGN_POST = assignMod.POST;
});

describe("ops case workflow routes", () => {
  it("forbids non-ops on GET", async () => {
    role = "user";
    const res = await CASE_GET(new Request("http://localhost/api/ops/case?requestId=req_case&window=15m"));
    expect(res.status).toBe(403);
  });

  it("returns workflow and evidence for ops", async () => {
    role = "support";
    claimConflict = false;
    const res = await CASE_GET(new Request("http://localhost/api/ops/case?requestId=req_case&window=15m"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.workflow.requestId).toBe("req_case");
    expect(body.evidence.length).toBe(2);
    expect(body.evidence[0].id).toBe("ev_1");
    expect(body.context.userId).toBe("user_ctx");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns conflict on claim when already assigned", async () => {
    role = "support";
    claimConflict = true;
    const res = await CLAIM_POST(
      new Request("http://localhost/api/ops/case/claim", { method: "POST", body: JSON.stringify({ requestId: "req_case" }) })
    );
    expect(res.status).toBe(409);
    claimConflict = false;
  });

  it("requires admin to close case", async () => {
    role = "support";
    const res = await STATUS_POST(
      new Request("http://localhost/api/ops/case/status", {
        method: "POST",
        body: JSON.stringify({ requestId: "req_case", status: "closed" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns conflict on status change when assigned to another owner", async () => {
    role = "support";
    claimConflict = true;
    const res = await STATUS_POST(
      new Request("http://localhost/api/ops/case/status", {
        method: "POST",
        body: JSON.stringify({ requestId: "req_case", status: "monitoring" }),
      })
    );
    expect(res.status).toBe(409);
    claimConflict = false;
  });

  it("requires admin for assign", async () => {
    role = "support";
    const res = await ASSIGN_POST(
      new Request("http://localhost/api/ops/case/assign", {
        method: "POST",
        body: JSON.stringify({ requestId: "req_case", assignedToUserId: "user_next" }),
      })
    );
    expect(res.status).toBe(403);
  });
});
