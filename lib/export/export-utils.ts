import { sanitizeJsonStrings, sanitizeTextContent } from "@/lib/utils/autopack-sanitize";

export type ExportVariant = "standard" | "ats_minimal";

export function resolveExportVariant(value: string | null): ExportVariant {
  if (value === "ats_minimal") {
    return "ats_minimal";
  }
  return "standard";
}

export function sanitizeForExport(value: string) {
  return sanitizeTextContent(value);
}

export function sanitizeJsonForExport(value: unknown) {
  return sanitizeJsonStrings(value);
}

export function buildStarAnswersPayload(
  autopackAnswers: unknown,
  starDrafts: unknown
) {
  if (Array.isArray(autopackAnswers) && autopackAnswers.length > 0) {
    return autopackAnswers;
  }
  if (Array.isArray(starDrafts) && starDrafts.length > 0) {
    return starDrafts;
  }
  return [];
}
