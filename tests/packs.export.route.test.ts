/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let rateAllowed = true;

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
  class SimpleResponse {
    headers: SimpleHeaders;
    status: number;
    body: any;
    constructor(body?: any, init?: { status?: number; headers?: Record<string, string> | SimpleHeaders }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers =
        init?.headers instanceof SimpleHeaders ? init.headers : new SimpleHeaders(init?.headers ?? {});
    }
    async arrayBuffer() {
      if (this.body instanceof Uint8Array) {
        return this.body;
      }
      return Buffer.from(this.body ?? "");
    }
    async text() {
      if (typeof this.body === "string") return this.body;
      return JSON.stringify(this.body ?? {});
    }
  }
  (globalThis as any).Headers = SimpleHeaders as any;
  (globalThis as any).Request = SimpleRequest as any;
  (globalThis as any).Response = SimpleResponse as any;

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
      headers.set("x-request-id", "req_pack_export");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_pack_export" };
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

  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({
      supabase: {
        from: () => ({
          select: () => {
            const query = {
              eq: () => query,
              maybeSingle: async () => ({
                data: {
                  id: "version_1",
                  pack_id: "pack_1",
                  user_id: "user_pack",
                  outputs: { cv: { summary: "Summary", sections: [] }, coverLetter: "Cover", starStories: [], fitMap: [], rationale: "Why" },
                  created_at: "2024-01-01T00:00:00.000Z",
                },
                error: null,
              }),
            };
            return query;
          },
        }),
      },
      user: { id: "user_pack", email: "pack@example.com" },
    }),
  }));

  vi.doMock("@/lib/early-access", () => ({
    getEarlyAccessDecision: async () => ({ allowed: true, source: "db", allowlistMeta: { source: "db" } }),
  }));

  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 7 }),
  }));

  vi.doMock("@/lib/packs/packs-store", () => ({
    fetchApplicationPack: async () => ({ id: "pack_1", title: "Pack", roleTitle: "Role" }),
    updatePackStatus: async () => ({ id: "pack_1", status: "exported" }),
  }));

  vi.doMock("@/lib/packs/packs-docx", () => ({
    buildPackDocx: () => ({}),
  }));

  vi.doMock("@/lib/export/docx", () => ({
    packDoc: async () => Buffer.alloc(200),
  }));

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: async () => undefined,
  }));

  const mod = await import("@/app/api/packs/[id]/export/route");
  POST = mod.POST;
});

describe("packs export route", () => {
  it("returns docx response with headers", async () => {
    const res = await POST(
      new Request("http://localhost/api/packs/pack_1/export", {
        method: "POST",
        body: JSON.stringify({ versionId: "version_1", format: "docx", variant: "standard" }),
      }),
      { params: { id: "pack_1" } }
    );
    expect(res.headers.get("content-type")).toContain("application/vnd.openxmlformats");
    const length = Number(res.headers.get("content-length") ?? "0");
    expect(length).toBeGreaterThan(100);
  });
});
