/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from "vitest";

let counts = { autopack: 0, application: 0, exportCount: 0, interviewApps: 0, interviewExports: 0 };
let storedProgress: any = null;
const logMock = vi.fn();

const supabaseMock = {
  from: (table: string) => {
    if (table === "onboarding_progress") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: storedProgress, error: null }),
          }),
        }),
        upsert: async (payload: any) => {
          storedProgress = { user_id: payload.user_id, progress: payload.progress, skip_until: payload.skip_until ?? null };
          return { error: null };
        },
      };
    }
    if (table === "autopacks") {
      return {
        select: (_cols: string, _opts: any) => ({
          eq: () => ({ count: counts.autopack, data: null, error: null }),
        }),
      };
    }
    if (table === "applications") {
      return {
        select: (_cols: string, _opts: any) => ({
          eq: () => ({
            ilike: () => ({ count: counts.interviewApps, data: null, error: null }),
            count: counts.application,
            data: null,
            error: null,
          }),
        }),
      };
    }
    if (table === "application_apply_checklist") {
      return {
        select: (_cols: string, _opts: any) => ({
          eq: () => ({
            not: (_col: string) => ({
              count: _col.startsWith("cv") ? counts.exportCount : counts.interviewExports,
              data: null,
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({ eq: () => ({ count: 0, data: null, error: null }) }),
    };
  },
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => supabaseMock,
}));

vi.mock("@/lib/monetisation", () => ({
  logMonetisationEvent: (...args: any[]) => logMock(...args),
}));

describe("onboarding model helper", () => {
  beforeEach(() => {
    counts = { autopack: 0, application: 0, exportCount: 0, interviewApps: 0, interviewExports: 0 };
    storedProgress = null;
    logMock.mockReset();
  });

  it("builds todo model by default", async () => {
    const { getOnboardingModel } = await import("@/lib/onboarding/onboarding");
    const model = await getOnboardingModel({ userId: "user-1" });
    expect(model.doneCount).toBe(0);
    expect(model.totalCount).toBe(3);
    expect(model.steps.filter((s) => s.status === "todo").length).toBeGreaterThan(0);
  });

  it("marks steps done when counts present and logs auto-complete", async () => {
    counts = { autopack: 1, application: 1, exportCount: 1, interviewApps: 1, interviewExports: 0 };
    const { getOnboardingModel } = await import("@/lib/onboarding/onboarding");
    const model = await getOnboardingModel({ userId: "user-2", now: new Date("2024-01-01T00:00:00.000Z") });
    expect(model.doneCount).toBe(3);
    expect(model.steps.find((s) => s.key === "create_cv")?.status).toBe("done");
    expect(model.steps.find((s) => s.key === "export_cv")?.status).toBe("done");
    expect(logMock).toHaveBeenCalled();
  });
});
