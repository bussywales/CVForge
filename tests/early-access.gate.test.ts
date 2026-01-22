/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/rbac", () => ({
  getUserRole: vi.fn(async () => ({ role: "user" })),
  isOpsRole: (role: string) => role === "admin" || role === "ops" || role === "super_admin",
}));

describe("early access gate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EARLY_ACCESS_MODE = "on";
    process.env.EARLY_ACCESS_EMAILS = "allowed@example.com, another@site.com";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("blocks when mode on and email not invited", async () => {
    const { isEarlyAccessAllowed } = await import("@/lib/early-access");
    const allowed = await isEarlyAccessAllowed({ userId: "user-1", email: "nope@example.com" });
    expect(allowed).toBe(false);
  });

  it("allows invited email", async () => {
    const { isEarlyAccessAllowed } = await import("@/lib/early-access");
    const allowed = await isEarlyAccessAllowed({ userId: "user-1", email: "allowed@example.com" });
    expect(allowed).toBe(true);
  });

  it("bypasses when mode off", async () => {
    process.env.EARLY_ACCESS_MODE = "off";
    const { isEarlyAccessAllowed } = await import("@/lib/early-access");
    const allowed = await isEarlyAccessAllowed({ userId: "user-1", email: null });
    expect(allowed).toBe(true);
  });
});
