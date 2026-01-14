import { describe, expect, it } from "vitest";
import { markSelectedSuggestions } from "@/lib/evidence";

describe("evidence selected flags", () => {
  it("marks suggestions as selected when id is present", () => {
    const suggestions = [
      { id: "ach:1", label: "One" },
      { id: "wh:2:b0", label: "Two" },
    ];
    const selected = new Set(["wh:2:b0"]);

    const result = markSelectedSuggestions(suggestions, selected);

    expect(result[0].selected).toBe(false);
    expect(result[1].selected).toBe(true);
  });
});
