/// <reference types="vitest/globals" />
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let LIST_GET: any;
let SUMMARY_GET: any;
let CLAIM_POST: any;
let RELEASE_POST: any;
let UPDATE_POST: any;
let role = "support";
let rateAllowed = true;
const insertCaseAuditMock = vi.fn(async () => null);

const workflowRows = [
  {
    request_id: "req_a",
    status: "open",
    priority: "p1",
    assigned_to_user_id: "user_ops",
    last_touched_at: "2024-01-01T01:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T01:00:00.000Z",
    sla_due_at: "2024-01-01T01:00:00.000Z",
  },
  {
    request_id: "req_b",
    status: "investigating",
    priority: "p2",
    assigned_to_user_id: null,
    last_touched_at: "2024-01-01T02:00:00.000Z",
    created_at: "2024-01-01T01:00:00.000Z",
    updated_at: "2024-01-01T02:00:00.000Z",
    sla_due_at: "2024-01-01T05:00:00.000Z",
  },
];

const notesRows = [{ case_key: "req_a", case_type: "request", updated_at: "2024-01-01T01:30:00.000Z" }];
const evidenceRows = [
  { request_id: "req_a", created_at: "2024-01-01T01:45:00.000Z" },
  { request_id: "req_a", created_at: "2024-01-01T01:50:00.000Z" },
];
const contextRows = [
  { request_id: "req_a", user_id: "user_ctx", source: "ops_audit", confidence: "high" },
];

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-01-01T03:00:00.000Z"));

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
      headers.set("x-request-id", "req_cases");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_cases" };
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

  vi.doMock("@/lib/ops/ops-case-queue-store", () => ({
    upsertCaseQueueSources: async () => null,
  }));

  vi.doMock("@/lib/ops/ops-case-audit", () => ({
    insertCaseAudit: insertCaseAuditMock,
  }));

  vi.doMock("@/lib/ops/ops-audit-log", () => ({
    insertOpsAuditLog: async () => undefined,
  }));

  vi.doMock("@/lib/ops/ops-case-workflow", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ops/ops-case-workflow")>("@/lib/ops/ops-case-workflow");
    return {
      ...actual,
      claimCaseWorkflow: async () => ({ row: workflowRows[0], conflict: false }),
      releaseCaseWorkflow: async () => ({ ...workflowRows[0], assigned_to_user_id: null }),
      getCaseWorkflow: async () => workflowRows[0],
      getOrCreateCaseWorkflow: async () => workflowRows[0],
      updateCaseStatus: async () => ({ ...workflowRows[0], status: "monitoring" }),
      updateCasePriority: async () => ({ ...workflowRows[0], priority: "p0" }),
      assignCaseWorkflow: async () => ({ ...workflowRows[0], assigned_to_user_id: "user_admin" }),
    };
  });

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => {
        const baseRows =
          table === "ops_case_workflow"
            ? workflowRows
            : table === "ops_case_notes"
              ? notesRows
              : table === "ops_case_evidence"
                ? evidenceRows
                : table === "ops_request_context"
                  ? contextRows
                  : [];

        let rows = [...baseRows];
        const orders: Array<{ col: string; ascending: boolean }> = [];
        let limitValue: number | null = null;
        let countMode = false;
        let headMode = false;

        const query: any = {
          select: (_fields?: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) countMode = true;
            if (opts?.head) headMode = true;
            return query;
          },
          gte: (col: string, value: string) => {
            rows = rows.filter((row: any) => row[col] >= value);
            return query;
          },
          lt: (col: string, value: string) => {
            rows = rows.filter((row: any) => row[col] < value);
            return query;
          },
          eq: (col: string, value: string) => {
            rows = rows.filter((row: any) => row[col] === value);
            return query;
          },
          is: (col: string, value: any) => {
            if (value === null) rows = rows.filter((row: any) => row[col] === null);
            return query;
          },
          in: (col: string, values: string[]) => {
            rows = rows.filter((row: any) => values.includes(row[col]));
            return query;
          },
          ilike: (col: string, pattern: string) => {
            const term = pattern.replace(/%/g, "").toLowerCase();
            rows = rows.filter((row: any) => (row[col] ?? "").toLowerCase().includes(term));
            return query;
          },
          order: (col: string, opts?: { ascending?: boolean }) => {
            orders.push({ col, ascending: opts?.ascending ?? true });
            return query;
          },
          or: (expr: string) => {
            const match = expr.match(/(last_touched_at|created_at)\.lt\.([^,]+),and\(\1\.eq\.([^,]+),request_id\.lt\.([^\)]+)\)/);
            if (match) {
              const col = match[1];
              const ts = match[2];
              const id = match[3];
              rows = rows.filter((row: any) => row[col] < ts || (row[col] === ts && row.request_id < id));
            }
            return query;
          },
          limit: (value: number) => {
            limitValue = value;
            return query;
          },
          then: (resolve: any, reject: any) => {
            if (orders.length) {
              rows = rows.sort((a: any, b: any) => {
                for (const order of orders) {
                  if (a[order.col] === b[order.col]) continue;
                  return a[order.col] < b[order.col] ? (order.ascending ? -1 : 1) : order.ascending ? 1 : -1;
                }
                return 0;
              });
            }
            if (typeof limitValue === "number") rows = rows.slice(0, limitValue);
            const result = countMode ? { data: headMode ? null : rows, count: rows.length, error: null } : { data: rows, error: null };
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return query;
      },
    }),
  }));

  const listMod = await import("@/app/api/ops/cases/route");
  LIST_GET = listMod.GET;
  const summaryMod = await import("@/app/api/ops/cases/summary/route");
  SUMMARY_GET = summaryMod.GET;
  const claimMod = await import("@/app/api/ops/cases/claim/route");
  CLAIM_POST = claimMod.POST;
  const releaseMod = await import("@/app/api/ops/cases/release/route");
  RELEASE_POST = releaseMod.POST;
  const updateMod = await import("@/app/api/ops/cases/update/route");
  UPDATE_POST = updateMod.POST;
});

afterAll(() => {
  vi.useRealTimers();
});

describe("ops cases routes", () => {
  it("forbids non-ops", async () => {
    role = "user";
    const res = await LIST_GET(new Request("http://localhost/api/ops/cases?window=24h"));
    expect(res.status).toBe(403);
  });

  it("lists cases with filters", async () => {
    role = "support";
    const res = await LIST_GET(new Request("http://localhost/api/ops/cases?status=open&assigned=me&window=24h"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items.length).toBe(1);
    expect(body.items[0].requestId).toBe("req_a");
    expect(body.items[0].evidenceCount).toBe(2);
    expect(body.items[0].notesCount).toBe(1);
    expect(body.items[0].userContext.userId).toBe("user_ctx");
    expect(body.items[0].reason.code).toBe("MANUAL");
  });

  it("returns cursor for paging", async () => {
    role = "support";
    const res = await LIST_GET(new Request("http://localhost/api/ops/cases?window=24h&limit=1"));
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.nextCursor).toBeTruthy();
  });

  it("sorts by SLA due soonest", async () => {
    role = "support";
    const res = await LIST_GET(new Request("http://localhost/api/ops/cases?window=24h&sort=sla"));
    const body = await res.json();
    expect(body.items[0].requestId).toBe("req_a");
    expect(body.items[0].slaDueAt).toBe("2024-01-01T01:00:00.000Z");
  });

  it("filters breached cases", async () => {
    role = "support";
    const res = await LIST_GET(new Request("http://localhost/api/ops/cases?window=24h&breached=1"));
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].requestId).toBe("req_a");
  });

  it("returns summary counts", async () => {
    role = "support";
    const res = await SUMMARY_GET(new Request("http://localhost/api/ops/cases/summary"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.myAssignedCount).toBe(1);
    expect(body.summary.unassignedCount).toBe(1);
    expect(body.summary.ageingBuckets.over1h).toBe(1);
  });

  it("requires admin for assignment update", async () => {
    role = "support";
    const res = await UPDATE_POST(
      new Request("http://localhost/api/ops/cases/update", {
        method: "POST",
        body: JSON.stringify({ requestId: "req_a", assignedUserId: "user_admin" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("allows claim and release", async () => {
    role = "support";
    insertCaseAuditMock.mockClear();
    const claimRes = await CLAIM_POST(
      new Request("http://localhost/api/ops/cases/claim", { method: "POST", body: JSON.stringify({ requestId: "req_a" }) })
    );
    const releaseRes = await RELEASE_POST(
      new Request("http://localhost/api/ops/cases/release", { method: "POST", body: JSON.stringify({ requestId: "req_a" }) })
    );
    expect(claimRes.status).toBe(200);
    expect(releaseRes.status).toBe(200);
    expect(insertCaseAuditMock).toHaveBeenCalled();
  });
});
