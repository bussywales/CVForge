/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { coercePackOutputs } from "@/lib/packs/packs-model";

describe("pack model coercion", () => {
  it("defaults outputs to safe shapes", () => {
    const outputs = coercePackOutputs(null);
    expect(outputs.cv.sections).toEqual([]);
    expect(outputs.coverLetter).toBe("");
    expect(outputs.starStories).toEqual([]);
    expect(outputs.fitMap).toEqual([]);
    expect(outputs.rationale).toBe("");
  });

  it("sanitizes sections and fit map entries", () => {
    const outputs = coercePackOutputs({
      cv: {
        summary: "Summary",
        sections: [{ title: "Experience", bullets: ["Did X", 42] }],
      },
      fitMap: [{ requirement: "Req", match: "partial", evidence: ["Evidence", 123] }],
    });
    expect(outputs.cv.sections[0].bullets).toEqual(["Did X"]);
    expect(outputs.fitMap[0].match).toBe("partial");
  });
});
