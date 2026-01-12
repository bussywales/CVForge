import { describe, expect, it } from "vitest";
import { applicationStatusSchema } from "../lib/validators/application";
import { normaliseApplicationStatus } from "../lib/application-status";

describe("application status", () => {
  it("accepts allowed status values", () => {
    expect(applicationStatusSchema.safeParse("ready").success).toBe(true);
    expect(applicationStatusSchema.safeParse("interviewing").success).toBe(true);
  });

  it("rejects legacy status values", () => {
    expect(applicationStatusSchema.safeParse("interview").success).toBe(false);
  });

  it("normalises legacy status values", () => {
    expect(normaliseApplicationStatus("interview")).toBe("interviewing");
  });
});
