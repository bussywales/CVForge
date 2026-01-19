import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let applicationSingle: any;

beforeAll(async () => {
  class SimpleHeaders {
    private store: Record<string, string> = {};
    constructor(init?: Record<string, string>) {
      Object.entries(init ?? {}).forEach(([k, v]) => this.store[k.toLowerCase()] = v);
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
    body: any;
    headers: SimpleHeaders;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.body = init?.body ?? "";
      this.headers = new SimpleHeaders(init?.headers ?? {});
    }
    async json() {
      return JSON.parse(this.body);
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
    getSupabaseUser: async () => ({ user: { id: "u1", email: "ops@example.com" } }),
  }));

  vi.doMock("@/lib/rbac", () => ({
    getUserRole: async () => ({ role: "admin" }),
    isOpsRole: () => true,
  }));

  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  applicationSingle = vi.fn().mockResolvedValue({ data: { user_id: "11111111-1111-1111-1111-111111111111" }, error: null });
  const applicationEq = vi.fn().mockReturnValue({ single: applicationSingle });
  const applicationSelect = vi.fn().mockReturnValue({ eq: applicationEq });
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => {
        if (table === "applications") {
          return {
            select: applicationSelect,
          };
        }
        return {
          insert,
        };
      },
    }),
  }));

  const mod = await import("@/app/api/ops/support-link/route");
  POST = mod.POST;
});

describe("ops support-link route", () => {
  it("returns valid json with full url for subscription", async () => {
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "billing_subscription_80" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.trim().endsWith("}")).toBe(true);
    const parsed = JSON.parse(text);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.url).toBe("string");
    expect(parsed.url).toContain("from=ops_support");
    expect(parsed.url).toContain("support=1");
    expect(parsed.url).toContain("plan=monthly_80");
  });

  it("returns structured error for invalid kind", async () => {
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "bad_kind" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.error?.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects when application does not belong to the user", async () => {
    applicationSingle.mockResolvedValueOnce({ data: { user_id: "someone_else" }, error: null });
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "application", appId: "app-123", focus: "outreach" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("INVALID_APP");
  });

  it("returns application link with ops flags when valid", async () => {
    const req = new Request("http://localhost/api/ops/support-link", {
      method: "POST",
      body: JSON.stringify({ userId: "11111111-1111-1111-1111-111111111111", kind: "application_outreach", appId: "app-123" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    const parsed = JSON.parse(text);
    expect(parsed.url).toContain("/app/applications/app-123");
    expect(parsed.url).toContain("focus=outreach");
    expect(parsed.url).toContain("from=ops_support");
    expect(parsed.url).toContain("support=1");
  });
});
