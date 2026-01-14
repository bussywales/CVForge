import { describe, expect, it } from "vitest";
import { parseTab } from "./tabs";

describe("parseTab", () => {
  it("defaults to overview when no value provided", () => {
    expect(parseTab(undefined)).toBe("overview");
    expect(parseTab(null)).toBe("overview");
  });

  it("normalises to known tab keys", () => {
    expect(parseTab("Apply")).toBe("apply");
    expect(parseTab("EVIDENCE")).toBe("evidence");
    expect(parseTab("interview")).toBe("interview");
  });

  it("falls back to overview for unknown values", () => {
    expect(parseTab("foo")).toBe("overview");
    expect(parseTab("")).toBe("overview");
  });
});

import { computeTabBadges, resolveInitialTab } from "./tabs";

describe("resolveInitialTab", () => {
  it("prefers query param over stored value", () => {
    expect(
      resolveInitialTab({ queryTab: "apply", storedTab: "evidence", defaultTab: "overview" })
    ).toBe("apply");
  });

  it("falls back to stored value when query missing", () => {
    expect(
      resolveInitialTab({ queryTab: null, storedTab: "evidence", defaultTab: "overview" })
    ).toBe("evidence");
  });

  it("uses default when neither query nor stored tab exist", () => {
    expect(resolveInitialTab({ defaultTab: "interview" })).toBe("interview");
  });
});

describe("computeTabBadges", () => {
  it("returns badges only for positive counts and due flag", () => {
    const badges = computeTabBadges({
      pendingApplyItems: 2,
      evidenceGaps: 3,
      interviewPriority: 1,
      hasDueAction: true,
    });
    expect(badges).toEqual({
      apply: 2,
      evidence: 3,
      interview: 1,
      activity: "due",
    });
  });

  it("omits badges for zero values", () => {
    const badges = computeTabBadges({ pendingApplyItems: 0, evidenceGaps: 0, interviewPriority: 0 });
    expect(badges).toEqual({});
  });
});
