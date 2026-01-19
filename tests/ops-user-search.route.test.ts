import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;
let listUsersMock: any;
let getUserByIdMock: any;
let insertAuditMock: any;
let selectProfilesMock: any;
let selectRolesMock: any;
let getUserRoleMock: any;

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

  getUserRoleMock = vi.fn().mockResolvedValue({ role: "admin" });
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: getUserRoleMock,
    isOpsRole: (role: string) => role === "admin" || role === "super_admin" || role === "ops",
  }));

  insertAuditMock = vi.fn().mockResolvedValue({ data: null, error: null });
  listUsersMock = vi.fn().mockResolvedValue({
    data: { users: [{ id: "u_email", email: "test@example.com", created_at: "2023-01-02", lastPage: 1 }], lastPage: 1 },
    error: null,
  });
  getUserByIdMock = vi.fn().mockResolvedValue({
    data: { user: { id: "u_uuid", email: "uuid@example.com", created_at: "2023-01-01" } },
    error: null,
  });
  selectProfilesMock = vi.fn().mockReturnValue({
    in: () => ({ data: [{ user_id: "u_email", full_name: "Test User" }], error: null }),
  });
  selectRolesMock = vi.fn().mockReturnValue({
    in: () => ({ data: [{ user_id: "u_email", role: "user" }], error: null }),
  });

  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      auth: {
        admin: {
          listUsers: listUsersMock,
          getUserById: getUserByIdMock,
        },
      },
      from: (table: string) => {
        if (table === "profiles") {
          return { select: selectProfilesMock };
        }
        if (table === "user_roles") {
          return { select: selectRolesMock };
        }
        return {
          insert: insertAuditMock,
        };
      },
    }),
  }));

  const mod = await import("@/app/api/ops/users/search/route");
  GET = mod.GET;
});

describe("ops users search route", () => {
  it("returns match for email queries", async () => {
    const res = await GET(new Request("http://localhost/api/ops/users/search?q=test@example.com"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users[0]?.email).toBe("test@example.com");
    expect(data.users[0]?.name).toBe("Test User");
  });

  it("returns match for uuid queries", async () => {
    const res = await GET(new Request("http://localhost/api/ops/users/search?q=00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users[0]?.id).toBe("u_uuid");
  });

  it("rejects when query missing", async () => {
    const res = await GET(new Request("http://localhost/api/ops/users/search"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("BAD_INPUT");
  });

  it("rejects non-ops roles", async () => {
    getUserRoleMock.mockResolvedValueOnce({ role: "user" });
    const res = await GET(new Request("http://localhost/api/ops/users/search?q=test@example.com"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(data.error?.requestId).toBe("req_test");
  });
});
