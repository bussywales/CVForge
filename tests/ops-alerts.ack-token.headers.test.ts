/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;

describe("ops alerts ack token headers", () => {
  beforeAll(async () => {
    process.env.ALERTS_ACK_SECRET = "secret";
    class SimpleHeaders {
      private store: Record<string, string> = {};
      constructor(init?: HeadersInit) {
        if (init instanceof Headers) {
          init.forEach((value, key) => {
            this.store[key.toLowerCase()] = value;
          });
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => (this.store[key.toLowerCase()] = value));
        } else if (init && typeof init === "object") {
          Object.entries(init).forEach(([key, value]) => (this.store[key.toLowerCase()] = String(value)));
        }
      }
      set(key: string, value: string) {
        this.store[key.toLowerCase()] = value;
      }
      get(key: string) {
        return this.store[key.toLowerCase()] ?? null;
      }
      has(key: string) {
        return key.toLowerCase() in this.store;
      }
      forEach(cb: (value: string, key: string) => void) {
        Object.entries(this.store).forEach(([k, v]) => cb(v, k));
      }
      entries() {
        return Object.entries(this.store);
      }
    }
    (globalThis as any).Headers = SimpleHeaders as any;
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
        return this.body ? JSON.parse(this.body) : {};
      }
    }
    (globalThis as any).Request = SimpleRequest as any;
    class SimpleResponse {
      status: number;
      headers: any;
      private body: any;
      constructor(body?: any, init?: { status?: number; headers?: any }) {
        this.status = init?.status ?? 200;
        if (init?.headers instanceof SimpleHeaders) {
          this.headers = init.headers;
        } else if (init?.headers) {
          this.headers = new SimpleHeaders(init.headers as any);
        } else {
          this.headers = new SimpleHeaders();
        }
        this.body = body ?? null;
      }
      async json() {
        if (typeof this.body === "string") {
          try {
            return JSON.parse(this.body);
          } catch {
            return this.body;
          }
        }
        return this.body;
      }
    }
    (globalThis as any).Response = SimpleResponse as any;

    vi.doMock("next/server", () => ({
      NextResponse: {
        json: (body: any, init?: { status?: number; headers?: Headers }) => {
          const headers = new SimpleHeaders(init?.headers ?? {});
          if (!headers.has("content-type")) headers.set("content-type", "application/json");
          return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: headers as any });
        },
      },
    }));
    vi.doMock("@/lib/data/supabase", () => ({
      getSupabaseUser: async () => ({ user: { id: "ops-user" } }),
    }));
    vi.doMock("@/lib/rbac", () => ({
      getUserRole: async () => ({ role: "admin" }),
      isOpsRole: () => true,
    }));
    vi.doMock("@/lib/rate-limit-budgets", () => ({
      getRateLimitBudget: () => ({ limit: 5, windowMs: 1000, budget: "test" }),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: () => ({ allowed: true }),
    }));
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceRoleClient: () => ({
        from: () => ({
          select: () => ({
            eq: (_field: string, _value: any) => ({
              limit: () => ({
                single: () => ({ data: { id: "evt_header", window_label: "15m" }, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({}),
        }),
      }),
    }));
    vi.doMock("@/lib/monetisation", () => ({
      logMonetisationEvent: vi.fn(),
    }));

    const mod = await import("@/app/api/ops/alerts/ack-token/route");
    POST = mod.POST;
  });

  it("does not echo request headers and returns full token JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/ops/alerts/ack-token", {
        method: "POST",
        headers: {
          cookie: "sid=123",
          accept: "text/html",
          "content-length": "64",
        },
        body: JSON.stringify({ eventId: "evt_header" }),
      }) as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cookie")).toBeNull();
    expect(res.headers.get("accept")).toBeNull();
    expect(res.headers.get("content-length")).not.toBe("64");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body?.token).toBeTruthy();
    expect(String(body?.token).length).toBeGreaterThan(64);
    expect(body).toMatchObject({ ok: true, eventId: "evt_header" });
  });
});
