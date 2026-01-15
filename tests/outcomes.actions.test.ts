import { describe, expect, it } from "vitest";
import { computeActionSummaryForApplication } from "@/lib/outcome-loop";

describe("computeActionSummaryForApplication", () => {
  it("maps keys and returns zeroes when no data", async () => {
    const fakeClient: any = {
      from: () => ({
        select: () => ({
          match: () => ({ count: 0, error: null }),
        }),
      }),
    };
    const summary = await computeActionSummaryForApplication(
      fakeClient,
      "user",
      "app"
    );
    expect(summary).toMatchObject({
      evidence_selected: 0,
      outreach_logged: 0,
      practice_answers: 0,
      answer_pack_generated: 0,
      kit_downloaded: 0,
      exports: 0,
      followups_logged: 0,
    });
  });
});
