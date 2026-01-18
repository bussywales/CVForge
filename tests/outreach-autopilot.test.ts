import { describe, expect, it } from "vitest";
import { buildFollowupItems } from "@/lib/outreach-autopilot";

describe("outreach autopilot helper", () => {
  it("sorts overdue first and caps to 7", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const apps = Array.from({ length: 8 }).map((_, idx) => ({
      id: `app-${idx}`,
      job_title: "Role",
      company: "Co",
      next_action_due: idx === 0 ? "2024-01-05" : "2024-01-10",
      contact_email: "a@example.com",
    }));
    const items = buildFollowupItems(apps as any, now);
    expect(items.length).toBe(7);
    expect(items[0].id).toBe("app-0");
    expect(items[0].dueLabel).toBe("Overdue");
  });

  it("flags recovery when overdue >=3 days and picks channel", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const items = buildFollowupItems(
      [
        {
          id: "a1",
          job_title: "Role",
          company: "Co",
          next_action_due: "2024-01-06",
          contact_linkedin: "https://linkedin.com",
        },
      ] as any,
      now
    );
    expect(items[0].isRecovery).toBe(true);
    expect(items[0].channel).toBe("linkedin");
  });
});
