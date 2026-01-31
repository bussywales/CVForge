/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: any;
let rateAllowed = true;
let accessAllowed = true;

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
      headers.set("x-request-id", "req_pack");
      if (opts?.noStore ?? true) headers.set("cache-control", "no-store");
      return { headers, requestId: "req_pack" };
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
    getSupabaseUser: async () => ({ supabase: {}, user: { id: "user_pack", email: "pack@example.com" } }),
  }));

  vi.doMock("@/lib/early-access", () => ({
    getEarlyAccessDecision: async () => ({ allowed: accessAllowed, source: "db", allowlistMeta: { source: "db" } }),
  }));

  vi.doMock("@/lib/rate-limit-budgets", () => ({
    getRateLimitBudget: () => ({ limit: 10, windowMs: 60_000, budget: "test" }),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 7 }),
  }));

  vi.doMock("@/lib/monetisation", () => ({
    logMonetisationEvent: async () => undefined,
  }));

  vi.doMock("@/lib/packs/packs-store", () => ({
    fetchApplicationPack: async () => ({ id: "pack_1", userId: "user_pack", title: "Pack", status: "draft" }),
    updatePackStatus: async () => ({ id: "pack_1", status: "ready" }),
    createPackVersion: async () => ({
      id: "version_1",
      packId: "pack_1",
      userId: "user_pack",
      jobDescription: "JD",
      inputsMasked: {},
      outputs: { cv: { summary: "Summary", sections: [] }, coverLetter: "", starStories: [], fitMap: [], rationale: "" },
      modelMeta: { model: "test" },
      createdAt: "2024-01-01T00:00:00.000Z",
    }),
  }));

  vi.doMock("@/lib/packs/packs-generate", () => ({
    generatePackOutputs: async () => ({
      outputs: { cv: { summary: "Summary", sections: [] }, coverLetter: "", starStories: [], fitMap: [], rationale: "" },
      modelMeta: { model: "test" },
    }),
  }));

  const mod = await import("@/app/api/packs/[id]/generate/route");
  POST = mod.POST;
});

describe("packs generate route", () => {
  it("creates a version and returns normalized outputs", async () => {
    const res = await POST(
      new Request("http://localhost/api/packs/pack_1/generate", {
        method: "POST",
        body: JSON.stringify({ jobDescription: "JD", cvText: "CV", notes: "Notes" }),
      }),
      { params: { id: "pack_1" } }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.version.outputs.cv.sections).toEqual([]);
  });

  it("returns 429 when rate-limited", async () => {
    rateAllowed = false;
    const res = await POST(
      new Request("http://localhost/api/packs/pack_1/generate", {
        method: "POST",
        body: JSON.stringify({ jobDescription: "JD" }),
      }),
      { params: { id: "pack_1" } }
    );
    expect(res.status).toBe(429);
    rateAllowed = true;
  });
});
