/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      upsert: () => ({ error: null }),
      update: () => ({ error: null }),
      insert: () => ({ error: null }),
    }),
  }),
}));

vi.mock("@/lib/monetisation", () => ({
  logMonetisationEvent: vi.fn(async () => null),
}));

vi.mock("@/lib/early-access/invites", () => ({
  claimInviteForUser: vi.fn(async () => ({ status: "skipped", reason: "no_invite" })),
}));

describe("early access decision", () => {
  beforeEach(() => {
    dbEntry = null;
    process.env.EARLY_ACCESS_MODE = "on";
    process.env.EARLY_ACCESS_EMAILS = "env@example.com";
    mockRole.role = "user";
  });

  it("prefers ops bypass", async () => {
    mockRole.role = "admin";
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "u1", email: "nope@example.com" });
    expect(result.allowed).toBe(true);
    expect(result.source).toBe("ops");
  });

  it("prefers db allowlist over env", async () => {
    dbEntry = { user_id: "u1", granted_at: "2024-01-01T00:00:00.000Z", revoked_at: null, note: null };
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "u1", email: "env@example.com" });
    expect(result.source).toBe("db_user");
  });

  it("falls back to env allowlist", async () => {
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "u1", email: "env@example.com" });
    expect(result.allowed).toBe(true);
    expect(result.source).toBe("env");
  });

  it("blocks when not allowed", async () => {
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "u1", email: "nope@example.com" });
    expect(result.allowed).toBe(false);
    expect(result.source).toBe("blocked");
  });
});
