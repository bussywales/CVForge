const MAX_FILENAME_LENGTH = 80;

export type ExportFileType = "CV" | "Cover-Letter" | "STAR-Answers" | "Submission-Pack";

export function buildExportFilename(
  name: string,
  role: string | null,
  type: ExportFileType,
  extension: "docx" | "json" | "zip" = "docx"
) {
  const safeName = slugifyName(name) || "CVForge";
  const safeRole = role ? slugifyName(role) : "";
  const safeType = slugifyName(type);

  const parts = [safeName, safeType];
  if (safeRole) {
    parts.push(safeRole);
  }

  const base = parts.filter(Boolean).join("-");
  const trimmed = truncateFilename(base, extension);
  return `${trimmed}.${extension}`;
}

export function truncateFilename(base: string, extension: string) {
  const maxBaseLength = Math.max(1, MAX_FILENAME_LENGTH - extension.length - 1);
  if (base.length <= maxBaseLength) {
    return base;
  }
  return base.slice(0, maxBaseLength).replace(/-+$/g, "");
}

export function slugifyName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const words = cleaned.split(" ").filter(Boolean);
  const formatted = words.map((word) => formatWord(word));
  return formatted.join("-");
}

function formatWord(word: string) {
  if (/^[A-Z0-9]+$/.test(word) && word.length <= 5) {
    return word;
  }
  if (/[A-Z]{2,}/.test(word) && word.length <= 5) {
    return word.toUpperCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
