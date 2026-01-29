/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { buildCaseRange, resolveCaseWindow } from "@/lib/ops/ops-case-model";

describe("ops case model", () => {
  it("defaults window to 15m", () => {
    expect(resolveCaseWindow("nope")).toBe("15m");
  });

  it("builds deterministic range", () => {
    const now = new Date("2024-01-01T12:00:00.000Z");
    const range = buildCaseRange({ window: "15m", now });
    expect(range.toIso).toBe("2024-01-01T12:00:00.000Z");
    expect(range.fromIso).toBe("2024-01-01T11:45:00.000Z");
  });
});
