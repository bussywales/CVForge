import { describe, expect, it } from "vitest";
import { buildCadence } from "@/lib/conversion-cadence";

describe("conversion cadence", () => {
  it("prioritises overdue scheduled next action", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = buildCadence({
      status: "applied",
      lastActivityAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      nextActionDue: today,
    });
    expect(result.nextAction?.id).toBe("scheduled");
  });

  it("suggests linkedin follow-up after 7 days", () => {
    const result = buildCadence({
      status: "applied",
      lastActivityAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(
      result.nextAction?.id === "linkedin-followup" ||
        result.secondaryActions.some((a) => a.id === "linkedin-followup")
    ).toBe(true);
  });
});
