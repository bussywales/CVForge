import { describe, expect, it } from "vitest";
import { buildKeepMomentumModel } from "@/lib/keep-momentum";

const baseApp = {
  id: "app1",
  user_id: "u1",
  job_title: "Engineer",
  company: "Co",
  company_name: "Co",
  status: "draft",
  next_action_due: null,
  outreach_next_due_at: null,
  next_followup_at: null,
  last_outcome_at: null,
  outcome_at: null,
  selected_evidence: [],
  last_activity_at: "2024-01-02T00:00:00.000Z",
  created_at: "2024-01-01T00:00:00.000Z",
};

describe("keep momentum model", () => {
  it("recommends follow-up when none scheduled", () => {
    const model = buildKeepMomentumModel({ applications: [baseApp as any] });
    expect(model.primary?.ruleId).toBe("followup_gap");
  });

  it("recommends outcome when follow-up exists but no outcome", () => {
    const app = { ...baseApp, outreach_next_due_at: new Date(Date.now() + 86400000).toISOString() };
    const model = buildKeepMomentumModel({ applications: [app as any] });
    expect(model.primary?.ruleId).toBe("outcome_gap");
  });

  it("recommends interview prep when signals present", () => {
    const app = { ...baseApp, outreach_next_due_at: new Date(Date.now() + 86400000).toISOString(), last_outcome_at: new Date().toISOString() };
    const insights = { activities: [{ application_id: app.id, type: "interview_focus", occurred_at: new Date().toISOString() }], topActions: [], funnel: { drafted:0, submitted:0, interview:0, offer:0, rejected:0, noResponse:0, responseRate:0 }, correlations: [] } as any;
    const model = buildKeepMomentumModel({ applications: [app as any], insights });
    expect(model.primary?.ruleId).toBe("interview_prep");
  });

  it("uses fallback when all rules fail", () => {
    const app = {
      ...baseApp,
      outreach_next_due_at: new Date(Date.now() + 86400000).toISOString(),
      last_outcome_at: new Date().toISOString(),
      selected_evidence: [{}],
    };
    const model = buildKeepMomentumModel({ applications: [app as any] });
    expect(model.primary?.ruleId).toBe("fallback_pipeline");
    expect(model.status).toBe("complete");
    expect(model.ctaHref).toContain(app.id);
  });

  it("is deterministic for same input", () => {
    const input = { applications: [baseApp as any] };
    const first = buildKeepMomentumModel(input);
    const second = buildKeepMomentumModel(input);
    expect(first.primary?.ruleId).toBe(second.primary?.ruleId);
  });

  it("targets newest active application and ignores archived apps", () => {
    const model = buildKeepMomentumModel({
      applications: [
        { ...baseApp, id: "archived", status: "archived", last_activity_at: "2024-04-01T00:00:00.000Z" } as any,
        { ...baseApp, id: "older", status: "active", last_activity_at: "2024-02-01T00:00:00.000Z" } as any,
        { ...baseApp, id: "newer", status: "active", last_activity_at: "2024-03-01T00:00:00.000Z" } as any,
      ],
    });

    expect(model.primary?.applicationId).toBe("newer");
    expect(model.meta.targetAppId).toBe("newer");
    expect(model.ctaHref).toContain("newer");
  });

  it("provides a creation CTA when no applications exist", () => {
    const model = buildKeepMomentumModel({ applications: [] });
    expect(model.status).toBe("not_ready");
    expect(model.ctaHref).toBe("/app/applications/new");
  });
});
