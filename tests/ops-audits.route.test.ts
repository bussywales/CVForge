import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let builderLimit: number | null = null;

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
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new SimpleHeaders(init?.headers ?? {});
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
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/observability/sentry", () => ({
    captureServerError: () => undefined,
  }));

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops1", email: "ops@example.com" } }),
  }));

  const getUserRoleMock = vi.fn().mockResolvedValue({ role: "admin" });
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: getUserRoleMock,
    isOpsRole: (role: string) => role === "admin" || role === "super_admin" || role === "ops",
  }));

  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const makeBuilder = (rows: any[]) => {
    builderLimit = null;
    const builder: any = {
      rows,
      eq() {
        return this;
      },
      in() {
        return this;
      },
      gte() {
        return this;
      },
      lte() {
        return this;
      },
      order() {
        return this;
      },
      or() {
        return this;
      },
      limit(n: number) {
        builderLimit = n;
        this.limitVal = n;
        return this;
      },
      then(resolve: any) {
        const slice = this.limitVal ? this.rows.slice(0, this.limitVal) : this.rows;
        return resolve({ data: slice, error: null });
      },
    };
    return builder;
  };

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "actor@example.com" } }, error: null }),
        },
      },
      from: (table: string) => {
        if (table === "ops_audit_log") {
          const rows = [
            {
              id: "row1",
              created_at: "2024-01-02T00:00:00.000Z",
              actor_user_id: "actor1",
              target_user_id: "user1",
              action: "test_action",
              meta: { requestId: "req_row1", email: "secret@example.com" },
            },
            {
              id: "row2",
              created_at: "2024-01-01T00:00:00.000Z",
              actor_user_id: "actor2",
              target_user_id: "user2",
              action: "test_action2",
              meta: {},
            },
          ];
          return {
            select: () => makeBuilder(rows),
            insert: insertMock,
          };
        }
        if (table === "user_roles") {
          return {
            select: () => ({
              in: () => ({ data: [{ user_id: "actor1", role: "admin" }], error: null }),
            }),
          };
        }
        return { insert: insertMock };
      },
    }),
  }));

  const mod = await import("@/app/api/ops/audits/route");
  GET = mod.GET;
});

describe("ops audits route", () => {
  it("rejects forbidden roles", async () => {
    const { getUserRole } = await import("@/lib/rbac");
    (getUserRole as any).mockResolvedValueOnce({ role: "user" });
    const res = await GET(new Request("http://localhost/api/ops/audits"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.requestId).toBe("req_test");
  });

  it("rejects invalid userId", async () => {
    const res = await GET(new Request("http://localhost/api/ops/audits?userId=bad"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("BAD_INPUT");
  });

  it("returns masked items and pagination", async () => {
    const res = await GET(new Request("http://localhost/api/ops/audits?limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.masked).toBe(true);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items[0].actor?.email).toBe("actor@example.com");
    expect(data.items[0].meta.email).not.toBe("secret@example.com");
    expect(data.page?.hasMore).toBe(true);
    expect(typeof data.page?.nextCursor).toBe("string");
  });

  it("caps limit to 200", async () => {
    await GET(new Request("http://localhost/api/ops/audits?limit=999"));
    expect(builderLimit).toBe(201);
  });

  it("errors on bad cursor", async () => {
    const res = await GET(new Request("http://localhost/api/ops/audits?cursor=bad"));
    expect(res.status).toBe(400);
  });
});
