import { describe, expect, it } from "vitest";
import type { ApplicationRecord } from "../lib/data/applications";
import type { ProfileRecord } from "../lib/data/profile";
import { getOutreachSteps, renderOutreachTemplate } from "../lib/outreach-templates";

const baseApplication: ApplicationRecord = {
  id: "app-1",
  user_id: "user-1",
  job_title: "Network Manager",
  company: "Acme",
  company_name: "Acme Ltd",
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
  status: "ready",
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
  outreach_channel_pref: "email",
  source: null,
  created_at: "2024-01-01T00:00:00Z",
};

describe("outreach templates", () => {
  it("renders email template with role, company, signals, and metrics", () => {
    const step = getOutreachSteps()[0];
    const profile: ProfileRecord = {
      user_id: "user-1",
      full_name: "Busayo Adewale",
      headline: null,
      location: null,
      telemetry_opt_in: null,
      created_at: "2024-01-01T00:00:00Z",
    };
    const template = renderOutreachTemplate({
      channel: "email",
      step,
      application: baseApplication,
      profile,
      roleFitTopSignals: ["SIEM tuning", "CAB change control"],
      bestMetric: "Reduced MTTR by 35% and met 99.9% uptime.",
    });

    expect(template.subject).toContain("Network Manager");
    expect(template.subject).toContain("Acme");
    expect(template.body).toContain("SIEM tuning");
    expect(template.body).toContain("Reduced MTTR");
    expect(template.body).toContain("Hi Hiring Manager");
  });

  it("falls back to hiring manager when contact name is missing", () => {
    const step = getOutreachSteps()[1];
    const template = renderOutreachTemplate({
      channel: "linkedin",
      step,
      application: baseApplication,
      profile: null,
      roleFitTopSignals: [],
      bestMetric: null,
    });

    expect(template.body).toContain("Hi Hiring Manager");
    expect(template.body).not.toContain("[");
    expect(template.body).not.toContain("TBD");
  });
});
