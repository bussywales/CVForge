/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let POST: any;
let DEACTIVATE: any;
let MARK: any;
let role = "admin";
let rateAllowed = true;

const listMock = vi.fn();
const createMock = vi.fn();
const deactivateMock = vi.fn();
const markMock = vi.fn();
const testEventMock = vi.fn();

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
      this.method = init?.method ?? "POST";
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
    withRequestIdHeaders: (_h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders();
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
    getUserRole: async () => ({ role }),
    isOpsRole: (value: string) => value === "admin" || value === "support" || value === "super_admin",
    isAdminRole: (value: string) => value === "admin" || value === "super_admin",
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 12 }),
  }));
  vi.doMock("@/lib/ops/ops-alerts-test-event", () => ({
    createOpsAlertTestEvent: (...args: any[]) => testEventMock(...args),
  }));
  vi.doMock("@/lib/ops/training-scenarios", () => ({
    listTrainingScenarios: (...args: any[]) => listMock(...args),
    createTrainingScenario: (...args: any[]) => createMock(...args),
    deactivateScenario: (...args: any[]) => deactivateMock(...args),
    markTrainingScenarioAcknowledged: (...args: any[]) => markMock(...args),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => ({ insert: vi.fn().mockResolvedValue({}) }),
    }),
  }));

  const mod = await import("@/app/api/ops/training/scenarios/route");
  GET = mod.GET;
  POST = mod.POST;
  const deact = await import("@/app/api/ops/training/scenarios/[id]/deactivate/route");
  DEACTIVATE = deact.POST;
  const mark = await import("@/app/api/ops/training/scenarios/mark/route");
  MARK = mark.POST;
});

describe("ops training scenarios routes", () => {
  it("enforces RBAC on list", async () => {
    role = "user";
    rateAllowed = true;
    const res = await GET(new Request("http://localhost/api/ops/training/scenarios"));
    expect(res.status).toBe(403);
  });

  it("rate limits list with retry-after", async () => {
    role = "admin";
    rateAllowed = false;
    const res = await GET(new Request("http://localhost/api/ops/training/scenarios"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
  });

  it("creates scenario and returns headers", async () => {
    role = "admin";
    rateAllowed = true;
    testEventMock.mockResolvedValueOnce({ eventId: "evt_train" });
    createMock.mockResolvedValueOnce({
      id: "scn_1",
      created_at: "2024-01-01T00:00:00.000Z",
      created_by: "ops-user",
      scenario_type: "alerts_test",
      window_label: "15m",
      event_id: "evt_train",
      request_id: "req_test",
      meta: {},
      is_active: true,
    });
    const res = await POST(
      new Request("http://localhost/api/ops/training/scenarios", {
        method: "POST",
        body: JSON.stringify({ scenarioType: "alerts_test" }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(body.ok).toBe(true);
    expect(body.scenario.scenarioType).toBe("alerts_test");
  });

  it("rejects invalid scenario type", async () => {
    role = "admin";
    rateAllowed = true;
    const res = await POST(
      new Request("http://localhost/api/ops/training/scenarios", {
        method: "POST",
        body: JSON.stringify({ scenarioType: "unknown" }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("validates scenario id on deactivate", async () => {
    role = "admin";
    rateAllowed = true;
    const res = await DEACTIVATE(new Request("http://localhost/api/ops/training/scenarios/not-a-uuid/deactivate"), {
      params: { id: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("marks a scenario as acknowledged", async () => {
    role = "admin";
    rateAllowed = true;
    markMock.mockResolvedValueOnce({
      id: "scn_1",
      created_at: "2024-01-01T00:00:00.000Z",
      created_by: "ops-user",
      scenario_type: "alerts_test",
      window_label: "15m",
      event_id: "evt_train",
      request_id: "req_test",
      acknowledged_at: "2024-01-01T00:10:00.000Z",
      ack_request_id: "req_ack",
      meta: {},
      is_active: true,
    });
    const res = await MARK(
      new Request("http://localhost/api/ops/training/scenarios/mark", {
        method: "POST",
        body: JSON.stringify({ scenarioId: "scn_1", eventId: "evt_train", ackRequestId: "req_ack" }),
      }) as any
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scenario.acknowledgedAt).toBe("2024-01-01T00:10:00.000Z");
  });
});
