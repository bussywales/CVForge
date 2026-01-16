import { describe, expect, it } from "vitest";
import { buildDashboardActions } from "@/lib/dashboard";
import type { InsightTopAction } from "@/lib/insights";

describe("dashboard actions", () => {
  it("returns top actions ordered by priority and limited", () => {
    const actions: InsightTopAction[] = [
      {
        id: "c",
        label: "Third",
        why: "",
        href: "/app/applications/1?tab=activity",
        applicationId: "1",
        role: "",
        company: "",
        priority: 3,
      },
      {
        id: "a",
        label: "First",
        why: "",
        href: "/app/applications/1?tab=apply",
        applicationId: "1",
        role: "",
        company: "",
        priority: 1,
      },
      {
        id: "b",
        label: "Second",
        why: "",
        href: "/app/applications/1?tab=evidence",
        applicationId: "1",
        role: "",
        company: "",
        priority: 2,
      },
    ];

    const result = buildDashboardActions(actions, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
  });
});
