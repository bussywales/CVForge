import { describe, expect, it, vi } from "vitest";
import { generateReferralCode } from "@/lib/referrals";

describe("referrals", () => {
  it("generates prefixed code", () => {
    const code = generateReferralCode();
    expect(code.startsWith("cvf-")).toBe(true);
    expect(code.length).toBeGreaterThan(6);
  });
});
