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
