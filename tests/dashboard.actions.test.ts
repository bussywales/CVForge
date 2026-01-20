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

  it("dedupes by action key and keeps highest priority first", () => {
    const actions: InsightTopAction[] = [
      {
        id: "evidence-app1",
        label: "Evidence 1",
        why: "",
        href: "/app/applications/1?tab=evidence",
        applicationId: "1",
        role: "",
        company: "",
        priority: 2,
      },
      {
        id: "evidence-app2",
        label: "Evidence 2",
        why: "",
        href: "/app/applications/2?tab=evidence",
        applicationId: "2",
        role: "",
        company: "",
        priority: 1,
      },
      {
        id: "star-app3",
        label: "Star 3",
        why: "",
        href: "/app/applications/3?tab=evidence",
        applicationId: "3",
        role: "",
        company: "",
        priority: 3,
      },
    ];
    const result = buildDashboardActions(actions, 5);
    expect(result.map((r) => r.id)).toEqual(["evidence-app2", "star-app3"]);
  });

  it("caps to five actions after dedupe", () => {
    const actions: InsightTopAction[] = [
      { id: "evidence-1", label: "", why: "", href: "/a", applicationId: "1", role: "", company: "", priority: 1 },
      { id: "star-1", label: "", why: "", href: "/b", applicationId: "1", role: "", company: "", priority: 2 },
      { id: "practice-1", label: "", why: "", href: "/c", applicationId: "1", role: "", company: "", priority: 3 },
      { id: "followup-1", label: "", why: "", href: "/d", applicationId: "1", role: "", company: "", priority: 4 },
      { id: "jobtext-1", label: "", why: "", href: "/e", applicationId: "1", role: "", company: "", priority: 5 },
      { id: "extra-1", label: "", why: "", href: "/f", applicationId: "1", role: "", company: "", priority: 6 },
    ];
    const result = buildDashboardActions(actions, 5);
    expect(result).toHaveLength(5);
  });
});
