import { describe, expect, it } from "vitest";
import { buildSubscriptionRetention, computeRetentionRisk } from "@/lib/subscription-retention";

describe("subscription retention", () => {
  it("classifies retention risk", () => {
    expect(computeRetentionRisk({ completions: 0, movedForward: 0 })).toBe("high");
    expect(computeRetentionRisk({ completions: 1, movedForward: 0 })).toBe("medium");
    expect(computeRetentionRisk({ completions: 2, movedForward: 1 })).toBe("low");
  });

  it("suggests downgrade for light usage on monthly_80", () => {
    const summary = buildSubscriptionRetention({
      planKey: "monthly_80",
      ledger: [],
      weeklyReview: { applicationsMoved: 0, followupsSent: 0, outcomesLogged: 0, examples: [] },
      topActions: [],
    });
    expect(summary.saveOffer.show).toBe(true);
    expect(summary.saveOffer.suggestedPlanKey).toBe("monthly_30");
    expect(summary.risk).toBe("high");
  });
});
