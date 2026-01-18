import { describe, expect, it } from "vitest";
import { buildOutreachVariants } from "@/lib/outreach-variants";

describe("outreach variants", () => {
  it("returns three deterministic variants with quality cues", () => {
    const variants = buildOutreachVariants({
      role: "Product Manager",
      company: "Acme",
      contactName: "Alex",
      stage: "applied",
    });

    expect(variants.map((v) => v.key)).toEqual(["polite", "direct", "warm"]);
    expect(variants[0].quality.hasAsk).toBe(true);
    expect(variants[1].quality.lengthBand).toBe("short");
    expect(variants[2].body).toContain("Acme");
  });
});
