/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { safeReadJson, fetchJsonSafe } from "@/lib/http/safe-json";

function makeResponse(body: string, status: number, contentType: string) {
  return {
    status,
    headers: {
      get: (key: string) => (key.toLowerCase() === "content-type" ? contentType : null),
    },
    async json() {
      return JSON.parse(body);
    },
    async text() {
      return body;
    },
    ok: status >= 200 && status < 300,
  } as any as Response;
}

describe("safe json helpers", () => {
  it("returns ok for valid json", async () => {
    const res = makeResponse(JSON.stringify({ ok: true }), 200, "application/json");
    const parsed = await safeReadJson<{ ok: boolean }>(res);
    expect(parsed.ok).toBe(true);
    expect(parsed.json?.ok).toBe(true);
  });

  it("handles non json response", async () => {
    const res = makeResponse(":oops", 500, "text/html");
    const parsed = await safeReadJson(res);
    expect(parsed.ok).toBe(false);
    expect(parsed.text ?? "").toContain(":oops");
  });

  it("fetchJsonSafe handles json parse error", async () => {
    global.fetch = (async () => makeResponse("{bad", 200, "application/json")) as any;
    const result = await fetchJsonSafe<{ ok: boolean }>("http://example.com");
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("JSON_PARSE_ERROR");
  });
});
