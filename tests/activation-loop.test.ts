import { describe, expect, it } from "vitest";
import { buildActivationModel } from "@/lib/activation-loop";

const baseApp = {
  id: "app1",
  user_id: "u1",
  job_title: "Engineer",
  company: "Co",
  company_name: "Co",
  contact_name: null,
  contact_role: null,
  contact_email: null,
  contact_linkedin: null,
  job_url: null,
  job_description: "desc",
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

describe("activation loop helper", () => {
  it("suggests add application when none exist", () => {
    const model = buildActivationModel({ applications: [] });
    expect(model.steps[0].id).toBe("add_application");
    expect(model.progress.totalCount).toBeGreaterThan(0);
  });

  it("suggests outreach first when app exists but no outreach", () => {
    const model = buildActivationModel({ applications: [baseApp as any] });
    const next = model.steps.find((s) => !s.isDone);
    expect(next?.id).toBe("first_outreach");
  });

  it("suggests schedule when outreach done", () => {
    const model = buildActivationModel({
      applications: [{ ...baseApp, outreach_last_sent_at: new Date().toISOString() } as any],
    });
    const next = model.steps.find((s) => !s.isDone);
    expect(next?.id).toBe("schedule_followup");
  });

  it("suggests outcome when follow-up set", () => {
    const model = buildActivationModel({
      applications: [
        {
          ...baseApp,
          outreach_last_sent_at: new Date().toISOString(),
          outreach_next_due_at: new Date().toISOString(),
        } as any,
      ],
    });
    const next = model.steps.find((s) => !s.isDone);
    expect(next?.id).toBe("log_outcome");
  });

  it("marks mature users and keeps momentum", () => {
    const model = buildActivationModel({
      applications: [
        {
          ...baseApp,
          outreach_last_sent_at: new Date().toISOString(),
          outreach_next_due_at: new Date().toISOString(),
          last_outcome_status: "interview_scheduled",
        } as any,
      ],
    });
    expect(model.progress.doneCount).toBeGreaterThan(0);
    expect(model.steps.some((s) => s.id === "keep_momentum")).toBe(true);
    const pending = model.steps.find((s) => !s.isDone);
    expect(pending?.id).toBe("keep_momentum");
  });

  it("is deterministic for same input", () => {
    const input = { applications: [baseApp as any] };
    const first = buildActivationModel(input);
    const second = buildActivationModel(input);
    expect(first.steps.map((s) => s.id)).toEqual(second.steps.map((s) => s.id));
  });
});
