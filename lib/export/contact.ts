import { sanitizeInlineText } from "@/lib/utils/autopack-sanitize";

const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;
const PHONE_LABEL_REGEX = /\b(phone|mobile|tel|telephone|cell)\b/i;
const LINKEDIN_REGEX =
  /(https?:\/\/)?(www\.)?linkedin\.com\/[^\s)]+/i;

export function extractPhone(text: string) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!PHONE_LABEL_REGEX.test(line)) {
      continue;
    }
    const matches = line.match(PHONE_REGEX);
    if (!matches) {
      continue;
    }
    const candidate = matches.find(isLikelyPhoneNumber);
    if (candidate) {
      return candidate.replace(/\s+/g, " ").trim();
    }
  }

  const matches = text.match(PHONE_REGEX) ?? [];
  const candidate = matches.find(isLikelyPhoneNumber);
  return candidate ? candidate.replace(/\s+/g, " ").trim() : null;
}

export function extractLinkedIn(text: string) {
  const match = text.match(LINKEDIN_REGEX);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;]+$/, "").trim();
}

export function buildContactLine(parts: Array<string | null | undefined>) {
  const cleaned = parts
    .map((part) => (part ? sanitizeInlineText(part) : ""))
    .map((part) => part.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned.join(" | ");
}

function isLikelyPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16;
}
