/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { applyCaseNotesPatch, mergeChecklistPatch, sanitizeCaseNotesText } from "@/lib/ops/ops-case-notes";

describe("ops case notes helpers", () => {
  it("merges checklist patch and tracks toggles", () => {
    const existing = {
      open_alerts: { done: false, at: null, by: null },
    };
    const { next, toggledKeys } = mergeChecklistPatch({
      existing,
      patch: { open_alerts: true, unknown: true },
      actorId: "user_1",
      now: new Date("2024-01-01T00:00:00.000Z"),
    });
    expect(next.open_alerts.done).toBe(true);
    expect(toggledKeys).toEqual(["open_alerts"]);
    expect(next.unknown).toBeUndefined();
  });

  it("marks outcome_recorded when outcome is set", () => {
    const { nextChecklist, nextOutcome, toggledKeys } = applyCaseNotesPatch({
      existing: null,
      patch: { outcome_code: "resolved", notes: "Done" },
      actorId: "user_ops",
      now: new Date("2024-01-02T00:00:00.000Z"),
    });
    expect(nextOutcome).toBe("resolved");
    expect(nextChecklist.outcome_recorded?.done).toBe(true);
    expect(toggledKeys).toContain("outcome_recorded");
  });

  it("sanitises notes by redacting emails and URLs", () => {
    const input = "User foo@example.com hit https://example.com";
    const output = sanitizeCaseNotesText(input);
    expect(output).toContain("[email-redacted]");
    expect(output).toContain("[url-redacted]");
  });
});
