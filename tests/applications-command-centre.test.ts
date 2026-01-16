import { describe, expect, it } from "vitest";
import { buildCommandCentreItems } from "@/lib/applications-command-centre";
import type { ApplicationRecord } from "@/lib/data/applications";

const baseApp: ApplicationRecord = {
  id: "",
  user_id: "",
  job_title: "",
  company: null,
  company_name: null,
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
  status: "draft",
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
};

describe("buildCommandCentreItems", () => {
  it("sorts by urgency and labels next actions", () => {
    const apps: ApplicationRecord[] = [
      {
        ...baseApp,
        id: "1",
        job_title: "Engineer",
        status: "draft",
        job_description: "",
      },
      {
        ...baseApp,
        id: "2",
        job_title: "Designer",
        status: "submitted",
        job_description: "jd",
        next_followup_at: new Date(Date.now() - 1000).toISOString(),
      },
      {
        ...baseApp,
        id: "3",
        job_title: "PM",
        status: "draft",
        job_description: "has text",
      },
    ];

    const items = buildCommandCentreItems(apps, {
      evidence: {},
      star: {},
      autopack: {},
    });

    expect(items[0].id).toBe("2"); // follow-up due first
    expect(items[0].followupDue).toBe(true);
    expect(items[0].nextActionHref).toContain("/app/applications/2");
    expect(items.find((i) => i.id === "1")?.progressLabel).toBe("Ready: 0/5");
  });
});
