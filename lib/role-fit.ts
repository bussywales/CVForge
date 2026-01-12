const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "with",
  "within",
  "without",
  "for",
  "from",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "i",
  "me",
  "my",
  "he",
  "she",
  "his",
  "her",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "done",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might",
  "must",
  "will",
  "shall",
  "also",
  "other",
  "etc",
  "etc.",
  "such",
  "using",
  "use",
  "used",
  "via",
  "per",
  "over",
  "under",
  "into",
  "across",
  "up",
  "down",
  "out",
  "about",
  "including",
  "include",
  "includes",
  "included",
  "role",
  "responsibilities",
  "requirements",
  "skills",
  "skill",
  "experience",
  "experienced",
  "knowledge",
  "ability",
  "abilities",
  "team",
  "teams",
  "work",
  "working",
  "develop",
  "development",
  "deliver",
  "delivery",
  "project",
  "projects",
  "support",
  "supporting",
  "manage",
  "management",
  "stakeholders",
  "stakeholder",
  "business",
  "systems",
  "service",
  "services",
  "looking",
  "seeking",
  "candidate",
  "ideal",
  "day",
  "days",
  "year",
  "years",
  "month",
  "months",
  "week",
  "weeks",
]);

const ACRONYMS = new Set([
  "siem",
  "iam",
  "mttr",
  "cab",
  "cis",
  "ncsc",
  "aws",
  "sla",
  "itil",
  "hld",
  "lld",
  "vpn",
  "uk",
]);

const MAX_TERMS = 60;
const MAX_TERM_LENGTH = 30;
const MIN_TERM_LENGTH = 3;

export type RoleFitResult = {
  score: number;
  matchedTerms: string[];
  gapSuggestions: string[];
  matchedCount: number;
  totalTerms: number;
};

export function calculateRoleFit(
  jobDescription: string,
  evidence: string
): RoleFitResult {
  const termFrequency = buildTermFrequency(jobDescription);
  const termEntries = Array.from(termFrequency.entries());
  const totalTerms = Math.min(termEntries.length, MAX_TERMS);

  if (totalTerms === 0) {
    return {
      score: 0,
      matchedTerms: [],
      gapSuggestions: [],
      matchedCount: 0,
      totalTerms: 0,
    };
  }

  const evidenceCorpus = normalizeText(evidence);
  const matched: Array<[string, number]> = [];
  const unmatched: Array<[string, number]> = [];

  for (const [term, count] of termEntries) {
    if (matchesTerm(evidenceCorpus, term)) {
      matched.push([term, count]);
    } else {
      unmatched.push([term, count]);
    }
  }

  const matchedCount = matched.length;
  const score = clamp(
    Math.round((matchedCount / totalTerms) * 100),
    0,
    100
  );

  const matchedTerms = matched
    .sort(sortByFrequency)
    .slice(0, 6)
    .map(([term]) => formatTerm(term));

  const gapTerms = unmatched
    .sort(sortByFrequency)
    .slice(0, 6)
    .map(([term]) => term);

  const gapSuggestions = buildGapSuggestions(gapTerms);

  return {
    score,
    matchedTerms,
    gapSuggestions,
    matchedCount,
    totalTerms,
  };
}

function buildTermFrequency(text: string): Map<string, number> {
  const tokens = extractTokens(text);
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const bigram = `${tokens[index]} ${tokens[index + 1]}`;
    if (bigram.length > MAX_TERM_LENGTH) {
      continue;
    }
    frequencies.set(bigram, (frequencies.get(bigram) ?? 0) + 1);
  }

  return frequencies;
}

function extractTokens(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .filter(isUsableToken);
}

function isUsableToken(token: string): boolean {
  if (token.length < MIN_TERM_LENGTH || token.length > MAX_TERM_LENGTH) {
    return false;
  }
  if (/^\d+$/.test(token)) {
    return false;
  }
  if (STOPWORDS.has(token)) {
    return false;
  }
  return true;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTerm(corpus: string, term: string): boolean {
  if (!corpus) {
    return false;
  }
  if (term.includes(" ") || term.includes("/") || term.includes("-")) {
    return corpus.includes(term);
  }
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  return pattern.test(corpus);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortByFrequency(
  [termA, countA]: [string, number],
  [termB, countB]: [string, number]
): number {
  if (countB !== countA) {
    return countB - countA;
  }
  return termA.localeCompare(termB);
}

function buildGapSuggestions(gapTerms: string[]): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const term of gapTerms) {
    const suggestion = suggestionForTerm(term);
    if (seen.has(suggestion)) {
      continue;
    }
    suggestions.push(suggestion);
    seen.add(suggestion);
  }

  return suggestions;
}

function suggestionForTerm(term: string): string {
  const lower = term.toLowerCase();

  if (/(incident|major incident|mttr|response|triage)/.test(lower)) {
    return "Highlight incident response experience (major incidents, triage, MTTR).";
  }
  if (/(change|cab|governance|itil)/.test(lower)) {
    return "Mention change governance (CAB/ITIL approvals) and impact.";
  }
  if (/(vulnerability|patch|cis|ncsc|hardening)/.test(lower)) {
    return "Add evidence of vulnerability management or patching (CIS/NCSC hardening).";
  }
  if (/(firewall|vpn|segmentation|zero trust)/.test(lower)) {
    return "Include network security controls (firewalls, segmentation, Zero Trust, VPN).";
  }
  if (/(siem|logging|detection|alerting)/.test(lower)) {
    return "Call out monitoring or detection outcomes (SIEM, logging, alerting).";
  }
  if (/(azure|aws|cloud)/.test(lower)) {
    return "Show cloud platform experience (Azure/AWS) and scope.";
  }
  if (/(documentation|documenting|hld|lld)/.test(lower)) {
    return "Add design documentation evidence (HLD/LLD).";
  }
  if (/(sla|uptime)/.test(lower)) {
    return "Add SLA/uptime metrics and outcomes.";
  }

  return `Add evidence for: ${formatTerm(term)} (tool used, scope, or measurable result).`;
}

function formatTerm(term: string): string {
  return term
    .split(" ")
    .map((segment) => formatSegment(segment))
    .join(" ");
}

function formatSegment(segment: string): string {
  const parts = segment.split(/([/-])/);
  return parts
    .map((part) => {
      if (part === "/" || part === "-") {
        return part;
      }
      if (ACRONYMS.has(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
