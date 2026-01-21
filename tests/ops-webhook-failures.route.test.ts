/// <reference types="vitest/globals" />
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: any;

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
      }),
    },
  }));
  vi.doMock("@/lib/observability/request-id", () => ({
    withRequestIdHeaders: (h?: HeadersInit) => ({ headers: new SimpleHeaders(h as any), requestId: "req_test" }),
    jsonError: ({ code, message, requestId, status = 500 }: any) => ({
      status,
      headers: new SimpleHeaders({ "x-request-id": requestId }),
      json: async () => ({ error: { code, message, requestId } }),
    }),
  }));
  vi.doMock("@/lib/data/supabase", () => ({
    getSupabaseUser: async () => ({ user: { id: "ops-user", email: "ops@example.com" } }),
  }));
  vi.doMock("@/lib/rbac", () => ({
    getUserRole: vi.fn().mockResolvedValue({ role: "admin" }),
    isOpsRole: () => true,
  }));

  vi.doMock("@/lib/ops/webhook-failures", () => ({
    listWebhookFailures: vi.fn().mockResolvedValue({
      items: [
        {
          id: "row_1",
          requestId: "req_123",
          at: "2024-02-10T10:00:00.000Z",
          code: "err_timeout",
          group: "stripe_webhook",
          actorMasked: "o***@example.com",
          userId: "user_1",
          summary: "Webhook error",
          eventIdHash: "abc123",
          groupKeyHash: "gk1",
          lastSeenAt: "2024-02-10T10:00:00.000Z",
          repeatCount: 2,
          correlation: { checkoutSeen: true, webhookSeen: false, creditChanged: false },
        },
      ],
      nextCursor: null,
    }),
  }));

  const route = await import("@/app/api/ops/webhook-failures/route");
  GET = route.GET;
});

describe("ops webhook failures route", () => {
  it("returns items with no-store headers", async () => {
    const res = await GET(new Request("http://localhost/api/ops/webhook-failures?since=24h"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.items[0].requestId).toBe("req_123");
    expect(body.items[0].repeatCount).toBeDefined();
  });
});
