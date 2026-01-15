import { describe, expect, it } from "vitest";
import { getEffectiveJobText } from "@/lib/job-text";
import type { ApplicationRecord } from "@/lib/data/applications";

const baseApplication: ApplicationRecord = {
  id: "app-1",
  user_id: "user-1",
  job_title: "Security Engineer",
  company: "Acme",
  company_name: "Acme Ltd",
  contact_name: null,
  contact_role: null,
  contact_email: null,
  contact_linkedin: null,
  job_url: null,
  job_description: "Manual job description",
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
  next_action_due: null,
  next_followup_at: null,
  outreach_stage: "not_started",
  outreach_last_sent_at: null,
  outreach_next_due_at: null,
  outreach_channel_pref: null,
  source: null,
  outcome_status: null,
  outcome_at: null,
  outcome_note: null,
  created_at: "2024-01-01T00:00:00Z",
};

describe("getEffectiveJobText", () => {
  it("prefers fetched snapshot when long enough", () => {
    const app = {
      ...baseApplication,
      job_description: "Manual",
      job_text_source: "fetched",
      job_text: "A".repeat(900),
    };

    expect(getEffectiveJobText(app)).toBe("A".repeat(900));
  });

  it("falls back to manual description when snapshot is short", () => {
    const app = {
      ...baseApplication,
      job_description: "Manual description",
      job_text_source: "fetched",
      job_text: "Short text",
    };

    expect(getEffectiveJobText(app)).toBe("Manual description");
  });
});
