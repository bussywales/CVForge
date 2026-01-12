const ASSUMPTIONS_HEADER_REGEX =
  /^\s*(#{1,6}\s*)?(assumptions(\/needs verification)?|needs verification)\s*:?\s*$/i;
const HEADING_LINE_REGEX = /^\s*(#{1,6}\s+).+/;
const PLACEHOLDER_TOKEN_REGEX = /\[[^\]]+\](?!\()/g;
const PLACEHOLDER_LINE_REGEX =
  /\b(todo|tbd|tbc|add metric|add metrics)\b/i;
const PLACEHOLDER_DETECT_REGEX =
  /\[[^\]]+\](?!\()|\b(todo|tbd|tbc|add metric|add metrics|needs verification|assumptions)\b/i;

function isHeadingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (HEADING_LINE_REGEX.test(trimmed)) {
    return true;
  }
  if (trimmed.length <= 60 && trimmed.endsWith(":")) {
    return true;
  }
  const hasLetters = /[A-Za-z]/.test(trimmed);
  if (hasLetters && trimmed === trimmed.toUpperCase() && trimmed.length <= 60) {
    return true;
  }
  return false;
}

export function sanitizeInlineText(value: string) {
  let cleaned = value.replace(PLACEHOLDER_TOKEN_REGEX, "");
  cleaned = cleaned.replace(/\b(todo|tbd|tbc)\b/gi, "");
  cleaned = cleaned.replace(/\badd metric(s)?\b/gi, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

export function sanitizeTextContent(text: string) {
  const rawLines = text.split(/\r?\n/);
  const sanitizedLines: string[] = [];
  let skipAssumptions = false;

  for (const rawLine of rawLines) {
    const trimmedLine = rawLine.trim();

    if (ASSUMPTIONS_HEADER_REGEX.test(trimmedLine)) {
      skipAssumptions = true;
      continue;
    }

    if (skipAssumptions) {
      if (isHeadingLine(rawLine)) {
        skipAssumptions = false;
      } else {
        continue;
      }
    }

    if (ASSUMPTIONS_HEADER_REGEX.test(trimmedLine)) {
      continue;
    }

    if (PLACEHOLDER_LINE_REGEX.test(trimmedLine)) {
      continue;
    }

    if (PLACEHOLDER_TOKEN_REGEX.test(rawLine)) {
      continue;
    }

    const cleaned = sanitizeInlineText(rawLine);
    sanitizedLines.push(cleaned);
  }

  const collapsed: string[] = [];
  let blankCount = 0;

  for (const line of sanitizedLines) {
    if (!line.trim()) {
      blankCount += 1;
      if (blankCount <= 2) {
        collapsed.push("");
      }
      continue;
    }
    blankCount = 0;
    collapsed.push(line.trimEnd());
  }

  return collapsed.join("\n").trim();
}

export function sanitizeJsonStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeInlineText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonStrings(entry));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = sanitizeJsonStrings(entry);
    });
    return result;
  }
  return value;
}

export function extractTextFromJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractTextFromJson).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map(extractTextFromJson)
      .join("\n");
  }
  return "";
}

export function hasPlaceholderTokens(text: string) {
  return PLACEHOLDER_DETECT_REGEX.test(text);
}
