import { describe, expect, it, vi } from "vitest";
import { buildExportFilename } from "../lib/export/filename";
import { extractBulletLines } from "../lib/export/docx";
import { buildSubmissionPackFiles } from "../lib/export/submission-pack";

vi.mock("../lib/utils/autopack-sanitize", () => ({
  sanitizeTextContent: vi.fn((value: string) => `clean:${value}`),
  sanitizeJsonStrings: (value: unknown) => value,
}));

describe("export utils", () => {
  it("builds deterministic filenames within length limits", () => {
    const filename = buildExportFilename(
      "Busayo Adewale",
      "Network TDA Manager",
      "CV",
      "docx"
    );
    expect(filename).toBe("Busayo-Adewale-CV-Network-TDA-Manager.docx");

    const longRole = "Senior ".repeat(30).trim();
    const longFilename = buildExportFilename(
      "Busayo Adewale",
      longRole,
      "Cover-Letter",
      "docx"
    );
    expect(longFilename.length).toBeLessThanOrEqual(80);
  });

  it("normalises bullet markers into bullet entries", () => {
    const bullets = extractBulletLines(
      "- first\n* second\n• third\n1. fourth\nNot bullet"
    );
    expect(bullets).toEqual(["first", "second", "third", "fourth"]);
  });

  it("builds submission pack entries with expected names", () => {
    const pack = buildSubmissionPackFiles({
      name: "Busayo Adewale",
      role: "Network TDA Manager",
      cvBuffer: Buffer.from("cv"),
      coverBuffer: Buffer.from("cover"),
      autopackAnswers: [{ answer: "foo" }],
      starDrafts: [],
    });

    expect(pack.entries).toHaveLength(3);
    expect(pack.entries[0].name).toContain("-CV-");
    expect(pack.entries[1].name).toContain("-Cover-Letter-");
    expect(pack.entries[2].name).toContain("-STAR-Answers-");
  });

  it("invokes sanitiser for export paths", async () => {
    const utils = await import("../lib/export/export-utils");
    const sanitize = await import("../lib/utils/autopack-sanitize");
    utils.sanitizeForExport("Draft content");
    expect((sanitize.sanitizeTextContent as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])
      .toBe("Draft content");
  });
});
