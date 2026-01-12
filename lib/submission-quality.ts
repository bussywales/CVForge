import { extractTopTerms } from "@/lib/jd-learning";
import { hasPlaceholderTokens } from "@/lib/utils/autopack-sanitize";

const BULLET_REGEX = /^[-*•]\s+/;
const METRIC_REGEX =
  /(\d|%|£|\$|€|\b(hours?|hrs?|days?|weeks?|months?|years?|mins?|minutes?|seconds?)\b|\b(kpi|sla)\b)/i;
const EXTRA_PLACEHOLDER_REGEX = /(\binsert\b|<)/i;

export type KeywordCoverage = {
  coveragePct: number;
  matchedCount: number;
  totalCount: number;
};

export type MetricsCoverage = {
  bulletCount: number;
  metricCount: number;
  longBullets: number;
};

export type SectionCoverage = {
  hasExperience: boolean;
  hasSkills: boolean;
};

export function calculateKeywordCoverage(
  jobDescription: string,
  evidence: string
): KeywordCoverage {
  const terms = extractTopTerms(jobDescription);
  if (terms.length === 0) {
    return { coveragePct: 0, matchedCount: 0, totalCount: 0 };
  }

  const corpus = normalizeText(evidence);
  const matched = terms.filter((term) => matchesKeyword(corpus, term));
  const coveragePct = Math.round((matched.length / terms.length) * 100);

  return {
    coveragePct,
    matchedCount: matched.length,
    totalCount: terms.length,
  };
}

export function countMetricBullets(cvText: string): MetricsCoverage {
  const lines = cvText.split(/\r?\n/);
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => BULLET_REGEX.test(line));
  const metricCount = bullets.filter((line) => METRIC_REGEX.test(line)).length;
  const longBullets = bullets.filter((line) => line.length > 240).length;

  return {
    bulletCount: bullets.length,
    metricCount,
    longBullets,
  };
}

export function detectMissingSections(cvText: string): SectionCoverage {
  return {
    hasExperience: /(^|\n)\s*(experience|employment)\b/i.test(cvText),
    hasSkills: /(^|\n)\s*(skills|key skills)\b/i.test(cvText),
  };
}

export function detectPlaceholders(text: string) {
  return hasPlaceholderTokens(text) || EXTRA_PLACEHOLDER_REGEX.test(text);
}

export function checkCoverConsistency(
  coverLetter: string,
  company: string,
  role: string
) {
  const trimmed = coverLetter.trim();
  if (!trimmed) {
    return {
      ok: false,
      hint: "Cover letter is empty.",
    };
  }

  const paragraph = trimmed.split(/\n\s*\n/)[0] ?? "";
  const header = paragraph.toLowerCase();
  const companyLower = company.toLowerCase();
  const roleLower = role.toLowerCase();
  const hasCompany = companyLower ? header.includes(companyLower) : false;
  const hasRole = roleLower ? header.includes(roleLower) : false;

  if (companyLower || roleLower) {
    if (!hasCompany && !hasRole) {
      return {
        ok: false,
        hint: "Mention the company or role in the opening paragraph.",
      };
    }
  }

  return { ok: true };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesKeyword(corpus: string, keyword: string): boolean {
  const normalisedKeyword = normalizeText(keyword);
  if (!normalisedKeyword) {
    return false;
  }
  if (
    normalisedKeyword.includes(" ") ||
    normalisedKeyword.includes("/") ||
    normalisedKeyword.includes("-")
  ) {
    return corpus.includes(normalisedKeyword);
  }
  const pattern = new RegExp(`\\b${escapeRegExp(normalisedKeyword)}\\b`, "i");
  return pattern.test(corpus);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
