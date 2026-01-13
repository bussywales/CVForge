import { sanitizeInlineText } from "@/lib/utils/autopack-sanitize";

export type InterviewPracticeBreakdown = {
  situation: number;
  task: number;
  action: number;
  result: number;
  metrics: number;
  relevance: number;
};

export type InterviewPracticeFlags = {
  missingMetrics: boolean;
  weakResult: boolean;
  vagueAction: boolean;
  tooLong: boolean;
  tooShort: boolean;
  lowRelevance: boolean;
  hasPlaceholders: boolean;
};

export type InterviewPracticeScore = {
  totalScore: number;
  breakdown: InterviewPracticeBreakdown;
  flags: InterviewPracticeFlags;
  recommendations: string[];
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "when",
  "where",
  "what",
  "why",
  "how",
  "over",
  "under",
  "between",
  "across",
  "your",
  "you",
  "our",
  "their",
  "they",
  "we",
  "was",
  "were",
  "are",
  "is",
  "to",
  "of",
  "in",
  "on",
  "by",
  "an",
  "a",
  "as",
  "at",
  "it",
  "or",
]);

const OWNERSHIP_VERBS = [
  "led",
  "delivered",
  "implemented",
  "reduced",
  "automated",
  "designed",
  "migrated",
  "remediated",
  "improved",
  "optimised",
  "optimized",
  "built",
  "owned",
  "created",
  "launched",
  "secured",
  "coordinated",
  "resolved",
  "triaged",
  "deployed",
  "streamlined",
  "saved",
];

const RESULT_CUES = [
  "reduced",
  "increased",
  "improved",
  "improvement",
  "saved",
  "avoided",
  "prevented",
  "mitigated",
  "resolved",
  "achieved",
  "raised",
  "cut",
  "lowered",
  "recovered",
  "restored",
  "uptime",
  "sla",
  "mttr",
  "risk",
  "incident",
  "compliance",
];

const CONTEXT_CUES = [
  "situation",
  "context",
  "background",
  "challenge",
  "when",
  "at the time",
  "stakeholder",
  "environment",
];

const TASK_CUES = [
  "task",
  "goal",
  "objective",
  "responsible",
  "responsibility",
  "aim",
  "needed to",
  "asked to",
];

const PLACEHOLDER_REGEX = /\b(tbd|lorem|example|needs verification|assumption|placeholder)\b|\[[^\]]+\]/i;

const METRIC_REGEX =
  /\b\d{1,3}(?:[.,]\d{1,3})?\s*%|\b\d+\s*percent\b|£\s?\d+|\b\d+(?:\.\d+)?\s*(ms|s|secs|seconds|min|mins|minutes|hours?|days?|weeks?|months?|years?)\b|\b\d+\s*(k|m)\b/gi;

export function buildQuestionKey(questionText: string, idx: number) {
  const slug = slugify(questionText).slice(0, 40) || "question";
  const hash = hashString(`${questionText}-${idx}`).toString(36).slice(0, 6);
  return `${slug}-${idx}-${hash}`;
}

export function scoreStarAnswer(input: {
  answerText: string;
  questionText: string;
  signals?: string[];
  gaps?: string[];
}): InterviewPracticeScore {
  const answerText = input.answerText?.trim() ?? "";
  const questionText = input.questionText?.trim() ?? "";

  if (!answerText) {
    return {
      totalScore: 0,
      breakdown: {
        situation: 0,
        task: 0,
        action: 0,
        result: 0,
        metrics: 0,
        relevance: 0,
      },
      flags: {
        missingMetrics: true,
        weakResult: true,
        vagueAction: true,
        tooLong: false,
        tooShort: true,
        lowRelevance: true,
        hasPlaceholders: false,
      },
      recommendations: [
        "Add a STAR answer before scoring for feedback.",
      ],
    };
  }
  const lower = answerText.toLowerCase();
  const length = answerText.length;

  const tooShort = length > 0 && length < 450;
  const tooLong = length > 2200;
  const hasPlaceholders = PLACEHOLDER_REGEX.test(lower);

  const metricsMatches = answerText.match(METRIC_REGEX) ?? [];
  const metricsCount = metricsMatches.length;
  const missingMetrics = metricsCount === 0;

  const ownershipCount = countMatches(lower, OWNERSHIP_VERBS);
  const resultCount = countMatches(lower, RESULT_CUES);
  const contextCount = countMatches(lower, CONTEXT_CUES);
  const taskCount = countMatches(lower, TASK_CUES);

  const situation = clamp(6 + contextCount * 4 + lengthBonus(length, 600), 0, 20);
  const task = clamp(6 + taskCount * 4 + lengthBonus(length, 800), 0, 20);
  const action = clamp(6 + ownershipCount * 4, 0, 20);
  const result = clamp(6 + resultCount * 4 + (missingMetrics ? 0 : 4), 0, 20);
  const metrics = missingMetrics ? 0 : clamp(8 + metricsCount * 4, 0, 20);

  const relevance = computeRelevanceScore({
    answerText,
    questionText,
    signals: input.signals ?? [],
    gaps: input.gaps ?? [],
  });

  const breakdown: InterviewPracticeBreakdown = {
    situation,
    task,
    action,
    result,
    metrics,
    relevance,
  };

  let totalScore =
    situation + task + action + result + metrics + relevance;

  if (tooShort) {
    totalScore -= 15;
  }
  if (tooLong) {
    totalScore -= 10;
  }
  if (hasPlaceholders) {
    totalScore -= 30;
  }

  totalScore = clamp(totalScore, 0, 100);

  const flags: InterviewPracticeFlags = {
    missingMetrics,
    weakResult: resultCount === 0,
    vagueAction: ownershipCount < 2,
    tooLong,
    tooShort,
    lowRelevance: relevance < 8,
    hasPlaceholders,
  };

  const recommendations = buildRecommendations(flags, input.signals, input.gaps);

  return {
    totalScore,
    breakdown,
    flags,
    recommendations,
  };
}

function buildRecommendations(
  flags: InterviewPracticeFlags,
  signals?: string[],
  gaps?: string[]
) {
  const recommendations: string[] = [];

  if (flags.hasPlaceholders) {
    recommendations.push("Replace placeholders with real outcomes and evidence.");
  }
  if (flags.tooShort) {
    recommendations.push("Add more context on the situation and task (aim for 450+ characters).");
  }
  if (flags.tooLong) {
    recommendations.push("Trim to the most relevant actions and results for this role.");
  }
  if (flags.vagueAction) {
    recommendations.push("Use ownership verbs to show what you delivered personally.");
  }
  if (flags.weakResult) {
    recommendations.push("Clarify the outcome and business impact.");
  }
  if (flags.missingMetrics) {
    recommendations.push("Add a measurable metric (%, time saved, cost, risk reduction).");
  }
  if (flags.lowRelevance) {
    const focusSignals = [
      ...(signals ?? []),
      ...(gaps ?? []),
    ]
      .map((value) => sanitizeInlineText(value))
      .filter(Boolean)
      .slice(0, 2);
    if (focusSignals.length > 0) {
      recommendations.push(
        `Reference role signals such as ${focusSignals.join(" and ")}.`
      );
    } else {
      recommendations.push("Tie the answer back to the role signals from the job description.");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Keep the answer structured and focused on measurable impact.");
  }

  return recommendations;
}

function computeRelevanceScore(input: {
  answerText: string;
  questionText: string;
  signals: string[];
  gaps: string[];
}) {
  const keywordTokens = extractKeywords([
    input.questionText,
    ...input.signals,
    ...input.gaps,
  ]);
  if (keywordTokens.length === 0) {
    return 10;
  }

  const answerTokens = tokenize(normalise(input.answerText));
  const overlap = keywordTokens.filter((token) => answerTokens.has(token)).length;
  const max = Math.min(8, keywordTokens.length);
  const ratio = max === 0 ? 0 : overlap / max;
  return clamp(Math.round(ratio * 20), 0, 20);
}

function countMatches(text: string, phrases: string[]) {
  let count = 0;
  phrases.forEach((phrase) => {
    if (text.includes(phrase)) {
      count += 1;
    }
  });
  return count;
}

function extractKeywords(values: string[]) {
  const tokens = new Set<string>();
  values.forEach((value) => {
    const cleaned = normalizeValue(value);
    cleaned
      .split(/\s+/)
      .filter((token) => token.length >= 3)
      .forEach((token) => {
        if (!STOPWORDS.has(token)) {
          tokens.add(token);
        }
      });
  });
  return Array.from(tokens);
}

function normalizeValue(value: string) {
  return normalizeText(sanitizeInlineText(value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalise(value: string) {
  return normalizeText(value);
}

function tokenize(value: string) {
  const tokens = new Set<string>();
  value
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .forEach((token) => {
      if (!STOPWORDS.has(token)) {
        tokens.add(token);
      }
    });
  return tokens;
}

function lengthBonus(length: number, threshold: number) {
  if (length > threshold * 2) {
    return 6;
  }
  if (length > threshold) {
    return 4;
  }
  return 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
