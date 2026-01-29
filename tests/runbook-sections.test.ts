import { describe, expect, it } from "vitest";
import { RUNBOOK_SECTIONS, type RunbookCategory } from "@/lib/ops/runbook-sections";

const REQUIRED_CATEGORIES: RunbookCategory[] = [
  "Getting started",
  "Training",
  "Quick cards",
  "Templates",
  "Alerts",
  "Incidents",
  "Billing",
  "Webhooks",
  "Early access",
  "Rate limits",
  "Security",
  "Escalation",
  "Glossary",
];
const REQUIRED_SECTION_IDS = ["training-drills", "quick-cards", "escalation-templates"];

describe("runbook sections", () => {
  it("has unique kebab-case ids and required categories", () => {
    expect(RUNBOOK_SECTIONS.length).toBeGreaterThan(0);

    const ids = RUNBOOK_SECTIONS.map((section) => section.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    ids.forEach((id) => expect(kebab.test(id)).toBe(true));

    const categories = new Set(RUNBOOK_SECTIONS.map((section) => section.category));
    REQUIRED_CATEGORIES.forEach((category) => expect(categories.has(category)).toBe(true));
    REQUIRED_SECTION_IDS.forEach((sectionId) => expect(ids.includes(sectionId)).toBe(true));

    RUNBOOK_SECTIONS.forEach((section) => {
      expect(["support", "admin"]).toContain(section.ownerRole);
      expect(section.lastReviewedVersion.length).toBeGreaterThan(0);
      expect(section.reviewCadenceDays).toBeGreaterThan(0);
      expect(section.linkedSurfaces.length).toBeGreaterThan(0);
    });
  });
});
