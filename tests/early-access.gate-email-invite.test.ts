/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockRole = { role: "user" };
let dbEmailEntry: any = null;

vi.mock("@/lib/rbac", () => ({
  getUserRole: vi.fn(async () => mockRole),
  isOpsRole: (role: string) => role === "admin" || role === "ops" || role === "super_admin",
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: (field: string) => ({
          is: () => ({
            order: () => ({
              limit: () => ({ data: field === "email_hash" && dbEmailEntry ? [dbEmailEntry] : [] }),
            }),
          }),
        }),
      }),
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

describe("early access gate email invite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EARLY_ACCESS_MODE = "on";
    process.env.EARLY_ACCESS_EMAILS = "";
    mockRole.role = "user";
    dbEmailEntry = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows email invite even without userId", async () => {
    dbEmailEntry = { user_id: null, granted_at: null, invited_at: "2024-01-01T00:00:00.000Z", revoked_at: null, note: null };
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    const result = await getEarlyAccessDecision({ userId: "placeholder", email: "invited@example.com" });
    expect(result.allowed).toBe(true);
    expect(result.source).toBe("db_email");
  });
});
