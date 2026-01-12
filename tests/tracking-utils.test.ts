import { describe, expect, it } from "vitest";
import { isFollowupDue } from "../lib/tracking-utils";

describe("tracking utils", () => {
  it("flags follow-ups that are due", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isFollowupDue(past)).toBe(true);
  });

  it("ignores follow-ups in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isFollowupDue(future)).toBe(false);
  });
});
