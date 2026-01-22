import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let resetRateLimitStores: () => void;

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
    body?: any;
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
    withRequestIdHeaders: (h?: HeadersInit, _?: string, opts?: { noStore?: boolean }) => {
      const headers = new SimpleHeaders(h as any);
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
      text: async () => JSON.stringify({ error: { code, message, requestId } }),
    }),
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createServerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
    }),
  }));

  vi.doMock("@/lib/monetisation-log", () => ({
    processMonetisationLog: vi.fn().mockResolvedValue({
      status: 200,
      headers: new SimpleHeaders(),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    }),
  }));

  vi.doMock("@/lib/rate-limit", () => {
    let count = 0;
    return {
      checkRateLimit: () => {
        count += 1;
        if (count > 1) {
          return { allowed: false, retryAfterSeconds: 5, status: 429 };
        }
        return { allowed: true, remaining: 0 };
      },
      resetRateLimitStores: () => {
        count = 0;
      },
      getRateLimitSummary: () => ({ rateLimitHits: { billing_recheck: 0, monetisation_log: 0, ops_actions: 0 }, topLimitedRoutes24h: [] }),
    };
  });

  const mod = await import("@/app/api/monetisation/log/route");
  POST = mod.POST;
  const rateMod = await import("@/lib/rate-limit");
  resetRateLimitStores = rateMod.resetRateLimitStores;
});

afterEach(() => {
  resetRateLimitStores();
});

describe("monetisation log rate limit", () => {
  it("returns 429 when over limit", async () => {
    const makeReq = () =>
      new Request("http://localhost/api/monetisation/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "gate_shown" }),
      });
    await POST(makeReq());
    const res = await POST(makeReq());
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error.requestId).toBe("req_test");
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
