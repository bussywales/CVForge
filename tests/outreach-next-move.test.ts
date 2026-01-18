import { describe, expect, it } from "vitest";
import { buildNextMove } from "@/lib/outreach-next-move";

const baseApp = {
  id: "app-1",
  outreach_stage: null,
  outreach_next_due_at: null,
  next_followup_at: null,
  next_action_due: null,
  outcome_status: null,
};

describe("outreach next move", () => {
  it("suggests send follow-up when overdue", () => {
    const move = buildNextMove({
      application: { ...baseApp, outreach_next_due_at: new Date(Date.now() - 86400000).toISOString() },
    });
    expect(move.key).toBe("followup_send");
  });

  it("suggests log outcome when rejected triage", () => {
    const move = buildNextMove({
      application: { ...baseApp, outreach_stage: "triage_rejected" },
      triage: "rejected",
    });
    expect(move.key).toBe("log_outcome");
  });

  it("suggests prep interview when interested", () => {
    const move = buildNextMove({
      application: { ...baseApp, outreach_stage: "triage_interested" },
      triage: "interested",
    });
    expect(move.key).toBe("prep_interview");
  });
});
