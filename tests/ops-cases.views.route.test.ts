/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let POST: any;
let PATCH: any;
let DELETE: any;
let role = "support";
let rateAllowed = true;

let views: any[] = [];
let nextId = 1;

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
      headers.set("x-request-id", "req_views");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_views" };
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
  }));

  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));

  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 7 }),
  }));

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: () => {
        const context: { filters: Record<string, any> } = { filters: {} };

        const applyFilters = (rows: any[]) =>
          rows.filter((row) => Object.entries(context.filters).every(([key, value]) => row[key] === value));

        const selectQuery: any = {
          select: () => selectQuery,
          eq: (col: string, value: any) => {
            context.filters[col] = value;
            return selectQuery;
          },
          order: () => selectQuery,
          then: (resolve: any, reject: any) => {
            const data = applyFilters(views);
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };

        return {
          select: () => selectQuery,
          insert: (payload: any) => ({
            select: () => ({
              single: async () => {
                const row = {
                  id: `view_${nextId++}`,
                  user_id: payload.user_id,
                  name: payload.name,
                  is_default: payload.is_default ?? false,
                  view: payload.view ?? {},
                  created_at: payload.created_at,
                  updated_at: payload.updated_at,
                };
                views.push(row);
                return { data: row, error: null };
              },
            }),
          }),
          update: (payload: any) => {
            const updateQuery: any = {
              eq: (col: string, value: any) => {
                context.filters[col] = value;
                return updateQuery;
              },
              select: () => ({
                single: async () => {
                  const row = applyFilters(views)[0];
                  if (!row) return { data: null, error: null };
                  Object.assign(row, payload);
                  return { data: row, error: null };
                },
              }),
            };
            return updateQuery;
          },
          delete: () => {
            const deleteQuery: any = {
              eq: (col: string, value: any) => {
                context.filters[col] = value;
                return deleteQuery;
              },
              then: (resolve: any, reject: any) => {
                const before = views.length;
                views = views.filter((row) => !Object.entries(context.filters).every(([key, value]) => row[key] === value));
                const data = before === views.length ? null : {};
                return Promise.resolve({ data, error: null }).then(resolve, reject);
              },
            };
            return deleteQuery;
          },
        };
      },
    }),
  }));

  const mod = await import("@/app/api/ops/cases/views/route");
  GET = mod.GET;
  POST = mod.POST;
  PATCH = mod.PATCH;
  DELETE = mod.DELETE;
});

describe("ops case views routes", () => {
  it("forbids non-ops on GET", async () => {
    role = "user";
    const res = await GET(new Request("http://localhost/api/ops/cases/views"));
    expect(res.status).toBe(403);
  });

  it("lists views for ops", async () => {
    role = "support";
    views = [
      {
        id: "view_a",
        user_id: "ops-user",
        name: "My view",
        is_default: true,
        view: { status: "open", assigned: "any", priority: "all", breached: false, window: "24h", sort: "lastTouched", q: "" },
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    ];
    const res = await GET(new Request("http://localhost/api/ops/cases/views"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.views.length).toBe(1);
    expect(body.views[0].name).toBe("My view");
  });

  it("creates a new view", async () => {
    role = "support";
    const res = await POST(
      new Request("http://localhost/api/ops/cases/views", {
        method: "POST",
        body: JSON.stringify({
          name: "Triage",
          view: { status: "waiting", assigned: "any", priority: "p0_p1", breached: false, window: "24h", sort: "sla", q: "" },
        }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.view.name).toBe("Triage");
  });

  it("updates a view name", async () => {
    role = "support";
    const res = await PATCH(
      new Request("http://localhost/api/ops/cases/views", {
        method: "PATCH",
        body: JSON.stringify({ id: "view_a", name: "Renamed" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.view.name).toBe("Renamed");
  });

  it("deletes a view", async () => {
    role = "support";
    const res = await DELETE(
      new Request("http://localhost/api/ops/cases/views", {
        method: "DELETE",
        body: JSON.stringify({ id: "view_a" }),
      })
    );
    expect(res.status).toBe(200);
  });
});
