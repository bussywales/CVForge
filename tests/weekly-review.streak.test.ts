import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/weekly-review";

describe("weekly review streak", () => {
  it("computes consecutive weeks above threshold", () => {
    const counts = {
      "2024-W02": 3,
      "2024-W01": 4,
      "2023-W52": 1,
    };
    expect(computeStreak(counts, "2024-W02", 3)).toBe(2);
  });

  it("returns zero when current week below threshold", () => {
    const counts = {
      "2024-W05": 2,
      "2024-W04": 5,
    };
    expect(computeStreak(counts, "2024-W05", 3)).toBe(0);
  });
});
