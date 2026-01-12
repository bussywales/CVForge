const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_REGEX = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE_REGEX = /(\+?\d[\d\s\-()]{7,}\d)/g;
const LONG_DIGIT_REGEX = /\b\d{6,}\b/g;

const STOPWORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "more",
  "most",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "within",
  "without",
  "would",
  "you",
  "your",
  "role",
  "responsibilities",
  "requirements",
  "skills",
  "experience",
  "candidate",
  "ideal",
  "team",
  "teams",
  "company",
  "business",
  "service",
  "services",
  "work",
  "working",
  "ability",
  "knowledge",
  "support",
  "supporting",
  "manage",
  "management",
  "delivery",
  "deliver",
  "project",
  "projects",
]);

const FLUFF_WORDS = new Set([
  "innovative",
  "dynamic",
  "fast",
  "paced",
  "fastpaced",
  "exciting",
  "passionate",
  "motivated",
  "proactive",
  "results",
  "driven",
  "team",
  "player",
  "excellent",
  "strong",
  "outstanding",
  "flexible",
  "adaptable",
]);

const DOMAIN_KEYWORDS: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: "network_security",
    keywords: [
      "siem",
      "firewall",
      "vulnerability",
      "patch",
      "incident response",
      "zero trust",
      "segmentation",
    ],
  },
  {
    slug: "project_delivery",
    keywords: ["project", "programme", "agile", "scrum", "raid", "raci", "prince2"],
  },
  {
    slug: "healthcare_ops",
    keywords: ["nhs", "clinical", "patient", "care", "healthcare", "hospital"],
  },
];

export type PackSignal = {
  id: string;
  label: string;
  weight: number;
  aliases: string[];
  gapSuggestions: string[];
  metricSnippets: string[];
};

export function redactPII(text: string) {
  return text
    .replace(EMAIL_REGEX, " ")
    .replace(URL_REGEX, " ")
    .replace(PHONE_REGEX, " ")
    .replace(LONG_DIGIT_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTopTerms(text: string) {
  const redacted = redactPII(text);
  const normalized = normalize(redacted);
  const tokens = normalized.split(" ").filter(Boolean);

  const counts = new Map<string, number>();
  const filtered = tokens.filter((token) => isCandidateToken(token));

  filtered.forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  for (let index = 0; index < filtered.length - 1; index += 1) {
    const phrase = `${filtered[index]} ${filtered[index + 1]}`;
    if (phrase.length > 6) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 30)
    .map(([term]) => term);
}

export function inferDomainGuess(jobTitle: string, text: string) {
  const combined = normalize(`${jobTitle} ${text}`);
  let best: { slug: string; score: number } | null = null;

  for (const entry of DOMAIN_KEYWORDS) {
    const score = entry.keywords.reduce(
      (total, keyword) => total + (combined.includes(keyword) ? 1 : 0),
      0
    );
    if (!best || score > best.score) {
      best = { slug: entry.slug, score };
    }
  }

  if (!best || best.score === 0) {
    return "general";
  }

  return best.slug;
}

export function buildPackProposal(
  terms: string[],
  domainGuess: string
) {
  const signals = terms.map((term, index) => {
    const label = toLabel(term);
    const weight = index < 5 ? 5 : index < 12 ? 4 : 3;
    return {
      id: slugify(term),
      label,
      weight,
      aliases: [term],
      gapSuggestions: [
        `Delivered ${label.toLowerCase()} improvements with clear ownership and reporting.`,
        `Improved ${label.toLowerCase()} outcomes by coordinating stakeholders and tracking results.`,
      ],
      metricSnippets: [
        clamp(`Improved ${label.toLowerCase()} by 25% while meeting agreed SLAs.`),
        clamp(`Reduced ${label.toLowerCase()} cycle time by 30% over two quarters.`),
      ],
    };
  });

  return {
    domain_guess: domainGuess,
    title: `${toTitle(domainGuess)} (draft)`,
    signals,
  };
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCandidateToken(token: string) {
  if (token.length < 4) {
    return false;
  }
  if (/^\d+$/.test(token)) {
    return false;
  }
  if (STOPWORDS.has(token)) {
    return false;
  }
  if (FLUFF_WORDS.has(token)) {
    return false;
  }
  return true;
}

function toLabel(term: string) {
  return term
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toTitle(value: string) {
  if (!value) {
    return "General";
  }
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugify(value: string) {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function clamp(value: string) {
  if (value.length <= 120) {
    return value;
  }
  return value.slice(0, 120).replace(/[.;:,]+$/g, "").trim();
}
