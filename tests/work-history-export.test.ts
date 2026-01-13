import { describe, expect, it } from "vitest";
import type { WorkHistoryRecord } from "../lib/data/work-history";
import { buildWorkHistorySection } from "../lib/export/docx";

describe("work history export", () => {
  it("includes Professional Experience section when roles exist", () => {
    const entries: WorkHistoryRecord[] = [
      {
        id: "role-1",
        user_id: "user-1",
        job_title: "Network Engineer",
        company: "Acme Ltd",
        location: "London",
        start_date: "2022-01-01",
        end_date: null,
        is_current: true,
        summary: "Owned core network operations.",
        bullets: ["Improved uptime to 99.9%."],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const section = buildWorkHistorySection(entries, "standard");
    expect(section?.title).toBe("Professional Experience");
    expect(section?.entries.length).toBe(1);
  });
});
