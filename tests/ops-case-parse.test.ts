/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { parseOpsCaseInput } from "@/lib/ops/ops-case-parse";

describe("ops case parse", () => {
  it("detects requestId", () => {
    const parsed = parseOpsCaseInput("req_1234", "requestId");
    expect(parsed.kind).toBe("requestId");
  });

  it("detects email", () => {
    const parsed = parseOpsCaseInput("support@example.com", "requestId");
    expect(parsed.kind).toBe("email");
  });

  it("respects userId mode", () => {
    const parsed = parseOpsCaseInput("b51b8f10-1a2b-4f0a-9ed0-7f2f605f8754", "userId");
    expect(parsed.kind).toBe("userId");
  });

  it("defaults empty input to unknown", () => {
    const parsed = parseOpsCaseInput("  ", "requestId");
    expect(parsed.kind).toBe("unknown");
  });
});
