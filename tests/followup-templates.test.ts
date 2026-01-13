import { describe, expect, it } from "vitest";
import {
  buildFollowupTemplates,
  buildLinkedInTemplate,
} from "../lib/followup-templates";

describe("follow-up templates", () => {
  it("fills templates with job details", () => {
    const templates = buildFollowupTemplates({
      contactName: "Sam",
      companyName: "ACME Corp",
      jobTitle: "Service Manager",
      appliedAt: "2025-01-10T12:00:00.000Z",
      jobUrl: "https://example.com/jobs/123",
      fullName: "Alex Smith",
    });

    expect(templates).toHaveLength(3);
    templates.forEach((template) => {
      expect(template.subject).toContain("Service Manager");
      expect(template.body).toContain("Service Manager");
      expect(template.body).not.toContain("[");
      expect(template.body).not.toContain("<");
    });
  });

  it("falls back when company and role are missing", () => {
    const templates = buildFollowupTemplates({});
    const linkedin = buildLinkedInTemplate({});

    expect(templates[0].subject).toContain("the role");
    expect(templates[0].body).toContain("the role");
    expect(linkedin.body).toContain("the role");
    expect(linkedin.body).not.toContain("undefined");
  });
});
