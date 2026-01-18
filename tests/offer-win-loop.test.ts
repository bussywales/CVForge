import { describe, expect, it } from "vitest";
import { buildOfferWinSteps, getOfferWinCandidate } from "@/lib/offer-win-loop";

describe("offer win loop", () => {
  it("selects most recent offer app", () => {
    const apps = [
      { id: "a1", job_title: "Role1", company: "X", last_outcome_status: "offer", last_outcome_at: "2024-01-01T00:00:00Z" },
      { id: "a2", job_title: "Role2", company: "Y", last_outcome_status: "negotiating", last_outcome_at: "2024-02-01T00:00:00Z" },
    ];
    const candidate = getOfferWinCandidate(apps as any);
    expect(candidate?.applicationId).toBe("a2");
    expect(candidate?.primaryHref).toContain("#offer-pack");
  });

  it("builds steps with correct anchors", () => {
    const steps = buildOfferWinSteps("app-1");
    expect(steps[0].href).toContain("#offer-pack");
    expect(steps[2].href).toContain("#outreach");
    expect(steps[3].href).toContain("#outcome");
  });

  it("returns null with no offer apps", () => {
    const candidate = getOfferWinCandidate([{ id: "a", last_outcome_status: "rejected" }] as any);
    expect(candidate).toBeNull();
  });
});
