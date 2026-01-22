/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockRole = { role: "user" };
let dbEntry: any = null;

vi.mock("@/lib/rbac", () => ({
  getUserRole: vi.fn(async () => mockRole),
  isOpsRole: (role: string) => role === "admin" || role === "ops" || role === "super_admin",
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              limit: () => ({ data: dbEntry ? [dbEntry] : [] }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

describe("early access gate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EARLY_ACCESS_MODE = "on";
    process.env.EARLY_ACCESS_EMAILS = "allowed@example.com, another@site.com";
    mockRole.role = "user";
    dbEntry = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("blocks when mode on and email not invited", async () => {
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "user-1", email: "nope@example.com" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("blocked");
  });

  it("allows invited email", async () => {
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "user-1", email: "allowed@example.com" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("env_allowlist");
  });

  it("bypasses when mode off", async () => {
    process.env.EARLY_ACCESS_MODE = "off";
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "user-1", email: null });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("env_allowlist");
  });

  it("prefers db allowlist over env", async () => {
    dbEntry = { user_id: "user-1", granted_at: "2024-01-01T00:00:00.000Z", revoked_at: null, note: null };
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "user-1", email: "allowed@example.com" });
    expect(result.reason).toBe("db_allowlist");
  });

  it("bypasses ops role", async () => {
    mockRole.role = "admin";
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "user-1", email: null });
    expect(result.reason).toBe("ops_bypass");
  });
});
