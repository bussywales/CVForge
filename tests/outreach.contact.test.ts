import { describe, expect, it } from "vitest";
import { buildMailto, isValidEmail, isValidLinkedIn } from "@/lib/outreach-mailto";

describe("outreach contact helpers", () => {
  it("validates email and linkedin", () => {
    expect(isValidEmail("person@example.com")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidLinkedIn("https://linkedin.com/in/example")).toBe(true);
    expect(isValidLinkedIn("ftp://example")).toBe(false);
  });

  it("builds mailto with encoded params", () => {
    const href = buildMailto({
      email: "person@example.com",
      subject: "Re: Role",
      body: "Line 1\nLine 2",
    });
    expect(href).toContain("mailto:person@example.com");
    expect(href).toContain("subject=Re%3A%20Role");
    expect(href).toContain("Line%201%0ALine%202");
  });
});
