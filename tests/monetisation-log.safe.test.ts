import { describe, expect, it, vi, beforeAll } from "vitest";

const logMonetisationEvent = vi.fn(async () => {
  throw new Error("db down");
});

vi.mock("@/lib/monetisation", () => ({
  logMonetisationEvent,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number; headers?: Headers }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? new Headers(),
      json: async () => body,
    }),
  },
}));

let processMonetisationLog: any;

beforeAll(async () => {
  if (!(globalThis as any).Headers) {
    (globalThis as any).Headers = class {
      private store: Record<string, string> = {};
      set(key: string, value: string) {
        this.store[key.toLowerCase()] = value;
      }
    };
  }
  ({ processMonetisationLog } = await import("@/lib/monetisation-log"));
});

describe("monetisation log safety", () => {
  it("returns ok:false instead of throwing when logging fails", async () => {
    const headers = new Headers();
    const res = await processMonetisationLog({
      supabase: {},
      userId: "user-1",
      parsed: { event: "gate_shown", applicationId: "00000000-0000-0000-0000-000000000000", surface: null, meta: {} } as any,
      requestId: "req_test",
      headers,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("LOG_FAIL");
  });
});
