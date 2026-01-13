import { describe, expect, it } from "vitest";
import {
  deriveNeedsFollowUp,
  isDueToday,
  isOverdue,
} from "../lib/tracking-utils";

const now = new Date("2025-01-15T12:00:00Z");

describe("pipeline utils", () => {
  it("detects due today and overdue dates", () => {
    expect(isDueToday("2025-01-15", "UTC", now)).toBe(true);
    expect(isOverdue("2025-01-14", "UTC", now)).toBe(true);
    expect(isOverdue("2025-01-16", "UTC", now)).toBe(false);
  });

  it("derives needs follow-up from status or due date", () => {
    expect(deriveNeedsFollowUp("applied", null, now, "UTC")).toBe(true);
    expect(deriveNeedsFollowUp("draft", "2025-01-14", now, "UTC")).toBe(true);
    expect(deriveNeedsFollowUp("draft", null, now, "UTC")).toBe(false);
  });
});
