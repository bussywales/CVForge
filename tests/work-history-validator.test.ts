import { describe, expect, it } from "vitest";
import { workHistorySchema } from "../lib/validators/work-history";

describe("work history validator", () => {
  it("rejects end date when marked current", () => {
    const result = workHistorySchema.safeParse({
      job_title: "Engineer",
      company: "Acme",
      location: "",
      start_date: "2022-01-01",
      end_date: "2023-01-01",
      is_current: true,
      summary: "",
      bullets: ["Did the thing."],
    });
    expect(result.success).toBe(false);
  });

  it("caps bullet count at 6", () => {
    const result = workHistorySchema.safeParse({
      job_title: "Engineer",
      company: "Acme",
      location: "",
      start_date: "2022-01-01",
      end_date: "",
      is_current: false,
      summary: "",
      bullets: [
        "One bullet.",
        "Two bullet.",
        "Three bullet.",
        "Four bullet.",
        "Five bullet.",
        "Six bullet.",
        "Seven bullet.",
      ],
    });
    expect(result.success).toBe(false);
  });
});
