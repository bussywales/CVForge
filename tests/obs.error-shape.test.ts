import { beforeAll, describe, expect, it } from "vitest";
import { jsonError } from "@/lib/observability/request-id";

class MockHeaders {
  private map = new Map<string, string>();
  constructor(entries?: Record<string, string>) {
    if (entries) {
      Object.entries(entries).forEach(([k, v]) => this.map.set(k.toLowerCase(), v));
    }
  }
  get(key: string) {
    return this.map.get(key.toLowerCase()) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key.toLowerCase(), value);
  }
}

class MockResponse {
  status: number;
  headers: MockHeaders;
  private body: string;
  constructor(body: any, init: { status?: number; headers?: Record<string, string> }) {
    this.body = typeof body === "string" ? body : JSON.stringify(body);
    this.status = init.status ?? 200;
    this.headers = new MockHeaders(init.headers);
  }
  async text() {
    return this.body;
  }
}

beforeAll(() => {
  // @ts-ignore
  globalThis.Response = MockResponse;
  // @ts-ignore
  globalThis.Headers = MockHeaders;
});

describe("observability error shape", () => {
  it("includes code and requestId", async () => {
    const reqId = "req_test_123";
    const res = jsonError({ code: "TEST_ERROR", message: "Something failed", requestId: reqId, status: 400 });
    const payload = JSON.parse(await res.text());
    expect(payload.error.code).toBe("TEST_ERROR");
    expect(payload.error.requestId).toBe(reqId);
    expect(res.headers.get("x-request-id")).toBe(reqId);
    expect(res.status).toBe(400);
  });
});
