import { describe, expect, it } from "vitest";
import { needsHardGate, shouldSoftGate } from "@/lib/billing/gating";

describe("billing gating", () => {
  it("requires hard gate when balance insufficient", () => {
    expect(needsHardGate(0, 1)).toBe(true);
    expect(needsHardGate(1, 2)).toBe(true);
  });

  it("allows soft gate when balance covers cost", () => {
    expect(shouldSoftGate(5, 1)).toBe(true);
  });
});
