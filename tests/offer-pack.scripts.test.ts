import { describe, expect, it } from "vitest";
import { buildNegotiationScripts } from "@/lib/offer-pack";

describe("offer pack scripts", () => {
  it("builds scripts with salary numbers", () => {
    const scripts = buildNegotiationScripts(
      {
        roleTitle: "Engineer",
        company: "Acme",
        baseSalary: 60000,
        currency: "GBP",
        recruiterName: "Alex",
        deadlineToRespond: "Friday",
      },
      {
        targetBase: 70000,
        asks: ["Hybrid days"],
      }
    );

    const polite = scripts.find((s) => s.key === "polite");
    expect(polite?.email).toContain("GBP 70,000");
    expect(polite?.email).toContain("Hybrid days");
  });

  it("handles missing salary with clarification wording", () => {
    const scripts = buildNegotiationScripts(
      {
        roleTitle: "Designer",
        company: "Bright",
        recruiterName: "Sam",
      },
      {
        asks: [],
      }
    );

    const direct = scripts.find((s) => s.key === "direct");
    expect(direct?.email).toContain("clarity on base");
  });
});
