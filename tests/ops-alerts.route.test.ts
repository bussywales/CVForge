/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
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
    headers: SimpleHeaders;
    constructor(url: string) {
      this.url = url;
      this.headers = new SimpleHeaders();
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
      headers.set("cache-control", "no-store");
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
    makeRequestId: () => "req_test",
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockImplementation(async () => ({ role })),
    isOpsRole: (r: string) => r === "admin" || r === "ops" || r === "super_admin",
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ budget: "test", limit: 5, windowMs: 1000 }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: true, remaining: 1 }),
    getRateLimitLog: () => [],
  }));
  vi.doMock("@/lib/ops/rag-status", () => ({
    buildRagStatus: vi.fn().mockResolvedValue({
      rulesVersion: "rag_v2_15m_trend",
      window: { minutes: 15, fromIso: "", toIso: "" },
      status: "amber",
      overall: "amber",
      headline: "test",
      signals: [{ key: "portal_errors", count: 0 }],
      topIssues: [],
      trend: { bucketMinutes: 15, fromIso: "", toIso: "", buckets: [], direction: "stable" },
      topRepeats: { requestIds: [], codes: [], surfaces: [] },
      updatedAt: "",
    }),
  }));
  vi.doMock("@/lib/ops/webhook-failures", () => ({
    listWebhookFailures: vi.fn().mockResolvedValue({ items: [] }),
  }));
  vi.doMock("@/lib/ops/ops-alerts-store", () => ({
    loadAlertStates: vi.fn().mockResolvedValue({}),
    saveAlertStatesAndEvents: vi.fn().mockResolvedValue({ transitions: [], updatedStates: {} }),
    listRecentAlertEvents: vi.fn().mockResolvedValue([]),
  }));
  vi.doMock("@/lib/ops/ops-alerts-notify", () => ({
    notifyAlertTransitions: vi.fn().mockResolvedValue([]),
  }));
  vi.doMock("@/lib/ops/ops-alerts", () => ({
    buildOpsAlerts: vi.fn().mockReturnValue({
      rulesVersion: "ops_alerts_v1_15m",
      window: { minutes: 15, fromIso: "", toIso: "" },
      headline: "h",
      firingCount: 0,
      alerts: [],
    }),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        insert: vi.fn().mockResolvedValue({}),
      }),
    }),
  }));

  const route = await import("@/app/api/ops/alerts/route");
  GET = route.GET;
});

describe("ops alerts route", () => {
  it("forbids non-ops", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/alerts"));
    expect(res.status).toBe(403);
  });

  it("returns alerts payload", async () => {
    role = "admin";
    const res = await GET(new Request("http://localhost/api/ops/alerts"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alerts).toBeDefined();
  });
});
