import { buildExportFilename } from "@/lib/export/filename";
import { buildStarAnswersPayload, sanitizeJsonForExport } from "@/lib/export/export-utils";

export type SubmissionPackEntry = {
  name: string;
  content: Buffer | string;
};

export type SubmissionPackFiles = {
  entries: SubmissionPackEntry[];
  zipFilename: string;
  starJson: string;
};

type SubmissionPackInput = {
  name: string;
  role: string | null;
  cvBuffer: Buffer;
  coverBuffer: Buffer;
  autopackAnswers: unknown;
  starDrafts: unknown;
};

export function buildSubmissionPackFiles({
  name,
  role,
  cvBuffer,
  coverBuffer,
  autopackAnswers,
  starDrafts,
}: SubmissionPackInput): SubmissionPackFiles {
  const cvFilename = buildExportFilename(name, role, "CV", "docx");
  const coverFilename = buildExportFilename(name, role, "Cover-Letter", "docx");
  const starFilename = buildExportFilename(name, role, "STAR-Answers", "json");
  const zipFilename = buildExportFilename(name, role, "Submission-Pack", "zip");

  const starPayload = sanitizeJsonForExport(
    buildStarAnswersPayload(autopackAnswers, starDrafts)
  );
  const starJson = JSON.stringify(starPayload, null, 2);

  return {
    entries: [
      { name: cvFilename, content: cvBuffer },
      { name: coverFilename, content: coverBuffer },
      { name: starFilename, content: starJson },
    ],
    zipFilename,
    starJson,
  };
}
