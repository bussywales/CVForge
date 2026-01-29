/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { normaliseId } from "@/lib/ops/normalise-id";

describe("normaliseId", () => {
  it("trims newline and whitespace", () => {
    expect(normaliseId("req_abc\n")).toBe("req_abc");
    expect(normaliseId("  req_abc\t")).toBe("req_abc");
  });
});
