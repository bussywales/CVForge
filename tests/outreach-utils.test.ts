import { describe, expect, it } from "vitest";
import { getNextOutreachStep } from "../lib/outreach-templates";
import { pickBestMetric } from "../lib/outreach-utils";

describe("outreach utils", () => {
  it("selects numeric metrics over non-numeric ones", () => {
    const metric = pickBestMetric([
      { metrics: "Improved stakeholder updates." },
      { metrics: "Reduced MTTR by 35% across critical incidents." },
    ]);
    expect(metric).toContain("35%");
  });

  it("advances outreach stages in order", () => {
    expect(getNextOutreachStep("not_started")?.stage).toBe("applied_sent");
    expect(getNextOutreachStep("applied_sent")?.stage).toBe("followup_1");
    expect(getNextOutreachStep("followup_1")?.stage).toBe("followup_2");
    expect(getNextOutreachStep("followup_2")?.stage).toBe("final_nudge");
    expect(getNextOutreachStep("final_nudge")).toBeNull();
  });
});
