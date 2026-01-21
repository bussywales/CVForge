/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let logMock: any;

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
    body: any;
    headers: SimpleHeaders;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "POST";
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
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockResolvedValue({ role: "admin" }),
    isOpsRole: (role: string) => role === "admin" || role === "super_admin",
  }));
  logMock = vi.fn().mockResolvedValue(undefined);
  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: logMock,
  }));
  vi.doMock("@/lib/supabase/service", () => ({
    createServiceRoleClient: () => ({}),
  }));

  const route = await import("@/app/api/ops/resolution-outcome/route");
  POST = route.POST;
});

describe("ops resolution outcome route", () => {
  it("rejects missing targets", async () => {
    const res = await POST(new Request("http://localhost", { body: JSON.stringify({ code: "PORTAL_RETRY_SUCCESS" }) }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("MISSING_TARGET");
  });

  it("succeeds for ops user", async () => {
    const res = await POST(
      new Request("http://localhost", {
        body: JSON.stringify({ code: "PORTAL_RETRY_SUCCESS", requestId: "req_1", note: "done" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(logMock).toHaveBeenCalledWith(expect.anything(), "ops-user", "ops_resolution_outcome_set", expect.anything());
  });
});
