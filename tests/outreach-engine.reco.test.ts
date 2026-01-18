import { describe, expect, it } from "vitest";
import { buildOutreachRecommendation, describeFollowupStatus } from "@/lib/outreach-engine";

const baseApp = {
  id: "app-1",
  user_id: "user",
  job_title: "Product Manager",
  company: "Acme",
  company_name: "Acme",
  contact_name: null,
  contact_role: null,
  contact_email: null,
  contact_linkedin: null,
  job_url: null,
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
  selected_evidence: null,
  applied_at: null,
  closing_date: null,
  submitted_at: null,
  source_platform: null,
  last_activity_at: null,
  last_touch_at: null,
  star_drafts: null,
  last_lift_action: null,
  lift_completed_at: null,
  next_action_type: null,
  next_action_due: null,
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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as any;

describe("outreach engine", () => {
  it("picks the first follow-up when nothing logged", () => {
    const reco = buildOutreachRecommendation({ application: baseApp });
    expect(reco?.stepId).toBe("applied");
    expect(reco?.body).toContain("Hi");
  });

  it("returns null when replied/closed", () => {
    const replied = buildOutreachRecommendation({
      application: { ...baseApp, outreach_stage: "replied" },
    });
    expect(replied).toBeNull();
  });

  it("labels follow-up status deterministically", () => {
    expect(describeFollowupStatus(null)).toContain("No follow-up");
    expect(describeFollowupStatus(new Date(Date.now() - 86400000).toISOString())).toContain("Overdue");
    expect(describeFollowupStatus(new Date().toISOString())).toContain("Due today");
  });
});
