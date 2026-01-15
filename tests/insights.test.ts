import { describe, expect, it } from "vitest";
import { getInsightsSummary } from "@/lib/insights";

describe("insights helper", () => {
  it("prioritises follow-up over job text when due", async () => {
    const fakeToday = new Date("2024-01-10T00:00:00Z");
    const supabase: any = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            data:
              table === "applications"
                ? [
                    {
                      id: "app1",
                      user_id: "user",
                      job_title: "Role",
                      company: "Co",
                      company_name: "Co",
                      job_description: "",
                      job_text: null,
                      job_text_source: null,
                      job_fetched_at: null,
                      job_fetch_status: null,
                      job_fetch_error: null,
                      job_fetch_etag: null,
                      job_fetch_last_modified: null,
                      job_text_hash: null,
                      job_source_url: null,
                      status: "applied",
                      selected_evidence: [],
                      applied_at: null,
                      closing_date: null,
                      submitted_at: null,
                      source_platform: null,
                      last_activity_at: null,
                      last_touch_at: null,
                      star_drafts: [],
                      last_lift_action: null,
                      lift_completed_at: null,
                      next_action_type: null,
                      next_action_due: "2024-01-09T00:00:00Z",
                      next_followup_at: null,
                      outreach_stage: null,
                      outreach_last_sent_at: null,
                      outreach_next_due_at: null,
                      outreach_channel_pref: null,
                      source: null,
                      last_outcome_status: null,
                      last_outcome_reason: null,
                      last_outcome_at: null,
                      last_outcome_id: null,
                      outcome_status: null,
                      outcome_at: null,
                      outcome_note: null,
                      created_at: "2024-01-01T00:00:00Z",
                    },
                  ]
                : [],
          }),
        }),
      }),
    };

    const summary = await getInsightsSummary(supabase as any, "user");
    expect(summary.topActions[0]?.id).toContain("followup");
  });
});
