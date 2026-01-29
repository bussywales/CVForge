/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let role = "admin";
let rateAllowed = true;
const deliveriesRows: any[] = [];
const eventsRows: any[] = [];

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
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role }),
    isOpsRole: (r: string) => r === "admin" || r === "ops" || r === "super_admin",
  }));
  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ budget: "test", limit: 5, windowMs: 1000 }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 12 }),
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => {
        if (table === "ops_alert_delivery") {
          let eventFilter: string | null = null;
          let statusFilter: string | null = null;
          let limitValue: number | null = null;
          const buildResult = () => {
            let rows = [...deliveriesRows];
            if (eventFilter) rows = rows.filter((row) => row.event_id === eventFilter);
            if (statusFilter) rows = rows.filter((row) => row.status === statusFilter);
            rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
            if (typeof limitValue === "number") rows = rows.slice(0, limitValue);
            return { data: rows, error: null };
          };
          const query: any = {
            select: () => query,
            order: () => query,
            limit: (value: number) => {
              limitValue = value;
              return query;
            },
            eq: (_field: string, value: string) => {
              if (_field === "event_id") eventFilter = value;
              if (_field === "status") statusFilter = value;
              return query;
            },
            then: (resolve: any, reject: any) => Promise.resolve(buildResult()).then(resolve, reject),
          };
          return query;
        }
        if (table === "ops_alert_events") {
          return {
            select: () => ({
              in: (_field: string, values: string[]) => ({
                data: eventsRows.filter((row) => values.includes(row.id)),
                error: null,
              }),
            }),
          };
        }
        return { select: () => ({ data: [], error: null }) };
      },
    }),
  }));

  const mod = await import("@/app/api/ops/alerts/deliveries/route");
  GET = mod.GET;
});

describe("ops alerts deliveries route", () => {
  it("filters by status and sorts newest first", async () => {
    role = "admin";
    rateAllowed = true;
    deliveriesRows.length = 0;
    eventsRows.length = 0;
    deliveriesRows.push(
      { id: 1, event_id: "evt_1", status: "failed", at: "2024-01-01T00:02:00.000Z", masked_reason: "status_500", window_label: "15m", created_at: "2024-01-01T00:02:00.000Z" },
      { id: 2, event_id: "evt_2", status: "delivered", at: "2024-01-01T00:03:00.000Z", masked_reason: null, window_label: "15m", created_at: "2024-01-01T00:03:00.000Z" },
      { id: 3, event_id: "evt_1", status: "failed", at: "2024-01-01T00:04:00.000Z", masked_reason: "status_429", window_label: "15m", created_at: "2024-01-01T00:04:00.000Z" }
    );
    eventsRows.push(
      { id: "evt_1", key: "ops_alert_test", summary_masked: "Webhook test notification", signals_masked: { is_test: true }, window_label: "15m" },
      { id: "evt_2", key: "ops_alert_test", summary_masked: "Other", signals_masked: { is_test: false }, window_label: "15m" }
    );
    const res = await GET(new Request("http://localhost/api/ops/alerts/deliveries?status=failed"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deliveries.length).toBe(2);
    expect(body.deliveries[0].eventId).toBe("evt_1");
    expect(body.deliveries[0].status).toBe("failed");
    expect(body.deliveries[0].createdAt).toBe("2024-01-01T00:04:00.000Z");
  });

  it("filters test deliveries", async () => {
    role = "admin";
    rateAllowed = true;
    const res = await GET(new Request("http://localhost/api/ops/alerts/deliveries?isTest=1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deliveries.every((row: any) => row.isTest)).toBe(true);
  });
});
