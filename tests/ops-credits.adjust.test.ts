import { describe, expect, it } from "vitest";
import { validateCreditPayload } from "@/app/api/ops/credits/adjust/route";

describe("validateCreditPayload", () => {
  it("rejects zero or out of range amounts", () => {
    expect(validateCreditPayload({ userId: "u1", amount: 0, reason: "Goodwill", note: null }).ok).toBe(false);
    expect(validateCreditPayload({ userId: "u1", amount: 600, reason: "Goodwill", note: null }).ok).toBe(false);
  });

  it("rejects invalid reason or note", () => {
    expect(validateCreditPayload({ userId: "u1", amount: 10, reason: "Bad", note: null }).ok).toBe(false);
    expect(validateCreditPayload({ userId: "u1", amount: 10, reason: "Goodwill", note: "x".repeat(141) }).ok).toBe(false);
  });

  it("accepts valid payload", () => {
    const result = validateCreditPayload({ userId: "u1", amount: -25, reason: "Refund", note: "short" });
    expect(result.ok).toBe(true);
  });
});
