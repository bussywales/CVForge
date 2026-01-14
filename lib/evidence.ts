import type { AchievementRecord } from "@/lib/data/achievements";
import type { WorkHistoryRecord } from "@/lib/data/work-history";
import type { RoleFitSignal } from "@/lib/role-fit";

export type EvidenceItem = {
  id: string;
  kind: "achievement" | "work_bullet";
  sourceType: "achievement" | "work_history";
  sourceId: string;
  title: string;
  text: string;
  dateRange?: string;
  signals: string[];
  weight: number;
  matchScores: Record<string, number>;
  qualityScore: number;
  qualityFlags: EvidenceQualityFlags;
  tokens: string[];
  tokenSet: Set<string>;
  normalizedText: string;
};

export type EvidenceSnippet = {
  snippet: string;
  shortSnippet: string;
};

export type EvidenceQualityFlags = {
  has_metric: boolean;
  has_tooling: boolean;
  has_scope: boolean;
  has_outcome: boolean;
  has_timeframe: boolean;
};

export type EvidenceMatch = {
  item: EvidenceItem;
  matchScore: number;
  qualityScore: number;
};

export type EvidenceBank = {
  items: EvidenceItem[];
  byId: Map<string, EvidenceItem>;
};

export type SelectedEvidenceEntry = {
  id: string;
  kind: EvidenceItem["kind"];
  signalId: string;
  note?: string;
  createdAt?: string;
};

type EvidenceBankInput = {
  profileHeadline?: string | null;
  profileLocation?: string | null;
  achievements: AchievementRecord[];
  workHistory: WorkHistoryRecord[];
  signals: RoleFitSignal[];
};

export function buildEvidenceBank({
  profileHeadline,
  profileLocation,
  achievements,
  workHistory,
  signals,
}: EvidenceBankInput): EvidenceBank {
  const items: EvidenceItem[] = [];
  const contextText = [profileHeadline, profileLocation].filter(Boolean).join(" ");
  const contextBoost = contextText ? 0.5 : 0;
  const signalMatchers = buildSignalMatchers(signals);

  achievements.forEach((achievement) => {
    const matchText = [
      achievement.title,
      achievement.situation,
      achievement.task,
      achievement.action,
      achievement.result,
      achievement.metrics,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!matchText) {
      return;
    }
    const displayText =
      achievement.metrics?.trim() ||
      achievement.result?.trim() ||
      achievement.action?.trim() ||
      "";
    if (!displayText) {
      return;
    }
    const normalizedText = normalizeEvidenceText(matchText);
    const tokens = tokenizeEvidence(matchText);
    const tokenSet = new Set(tokens);
    const quality = scoreEvidenceQuality(matchText);
    const matchScores = buildMatchScores({
      normalizedText,
      tokens,
      tokenSet,
      matchers: signalMatchers,
    });
    const signalsMatched = Object.keys(matchScores);
    items.push({
      id: `ach:${achievement.id}`,
      kind: "achievement",
      sourceType: "achievement",
      sourceId: achievement.id,
      title: achievement.title,
      text: displayText,
      signals: signalsMatched,
      weight: quality.score + contextBoost,
      matchScores,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
      tokens,
      tokenSet,
      normalizedText,
    });
  });

  workHistory.forEach((entry) => {
    const dateRange = formatDateRange(entry);
    const recencyBoost = getRecencyBoost(entry);
    const roleLabel = `${entry.job_title} @ ${entry.company}`;
    const summary = entry.summary?.trim() ?? "";
    const bullets = entry.bullets.length ? entry.bullets : summary ? [summary] : [];
    bullets.forEach((bullet, index) => {
      const text = bullet.trim();
      if (!text) {
        return;
      }
      const matchText = [roleLabel, summary, text]
        .filter(Boolean)
        .join(" ")
        .trim();
      const normalizedText = normalizeEvidenceText(matchText);
      const tokens = tokenizeEvidence(matchText);
      const tokenSet = new Set(tokens);
      const quality = scoreEvidenceQuality(matchText);
      const matchScores = buildMatchScores({
        normalizedText,
        tokens,
        tokenSet,
        matchers: signalMatchers,
      });
      const signalsMatched = Object.keys(matchScores);
      items.push({
        id: `wh:${entry.id}:b${index}`,
        kind: "work_bullet",
        sourceType: "work_history",
        sourceId: entry.id,
        title: roleLabel,
        text,
        dateRange,
      signals: signalsMatched,
      weight: quality.score + recencyBoost + contextBoost,
      matchScores,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
        tokens,
        tokenSet,
        normalizedText,
      });
    });
  });

  const byId = new Map<string, EvidenceItem>();
  items.forEach((item) => byId.set(item.id, item));

  return { items, byId };
}

export function scoreEvidenceMatch(text: string, signal: RoleFitSignal): number {
  const normalizedText = normalizeEvidenceText(text);
  const tokens = tokenizeEvidence(text);
  const tokenSet = new Set(tokens);
  const matcher = buildSignalMatcher(signal);
  return scoreMatchForSignal({ normalizedText, tokens, tokenSet }, matcher);
}

export function rankEvidenceForGap(
  gapSignalId: string,
  evidence: EvidenceBank,
  limit = 3
): EvidenceMatch[] {
  return evidence.items
    .map((item) => ({
      item,
      matchScore: item.matchScores[gapSignalId] ?? 0,
      qualityScore: item.qualityScore,
    }))
    .filter((entry) => entry.matchScore >= 0.6)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      if (b.qualityScore !== a.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }
      return b.item.weight - a.item.weight;
    })
    .slice(0, limit);
}

export function buildEvidenceSnippet(item: EvidenceItem): EvidenceSnippet {
  const prefix =
    item.kind === "work_bullet"
      ? `From ${item.title}${item.dateRange ? ` (${item.dateRange})` : ""}: `
      : "Evidence: ";
  const snippet = `${prefix}${item.text}`.trim();
  return {
    snippet,
    shortSnippet: trimToLength(snippet, 120),
  };
}

export function findEvidenceById(evidence: EvidenceBank, evidenceId: string) {
  return evidence.byId.get(evidenceId) ?? null;
}

export function normalizeSelectedEvidence(value: unknown): SelectedEvidenceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry as SelectedEvidenceEntry;
      if (!candidate.id || !candidate.signalId || !candidate.kind) {
        return null;
      }
      if (candidate.kind !== "achievement" && candidate.kind !== "work_bullet") {
        return null;
      }
      return {
        id: candidate.id,
        kind: candidate.kind,
        signalId: candidate.signalId,
        note: candidate.note,
        createdAt: candidate.createdAt,
      };
    })
    .filter(Boolean) as SelectedEvidenceEntry[];
}

export function dedupeSelectedEvidence(
  entries: SelectedEvidenceEntry[]
): SelectedEvidenceEntry[] {
  const seen = new Set<string>();
  const result: SelectedEvidenceEntry[] = [];
  entries.forEach((entry) => {
    const key = `${entry.id}:${entry.signalId}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(entry);
  });
  return result;
}

export function buildSelectedEvidenceSnippets(
  selected: SelectedEvidenceEntry[],
  evidence: EvidenceBank,
  maxItems = 6
) {
  const items: string[] = [];
  const deduped = dedupeSelectedEvidence(selected);
  deduped.forEach((entry) => {
    if (items.length >= maxItems) {
      return;
    }
    const item = findEvidenceById(evidence, entry.id);
    if (item) {
      items.push(buildEvidenceSnippet(item).shortSnippet);
      return;
    }
    if (entry.note) {
      items.push(trimToLength(entry.note, 120));
    }
  });
  return items;
}

export function parseEvidenceId(evidenceId: string) {
  if (evidenceId.startsWith("ach:")) {
    return { kind: "achievement" as const, sourceId: evidenceId.slice(4) };
  }
  if (evidenceId.startsWith("wh:")) {
    const match = evidenceId.match(/^wh:([^:]+):b(\d+)$/);
    if (!match) {
      return null;
    }
    return {
      kind: "work_bullet" as const,
      sourceId: match[1],
      bulletIndex: Number.parseInt(match[2], 10),
    };
  }
  return null;
}

export function scoreEvidenceQuality(text: string) {
  const lower = text.toLowerCase();
  const has_metric =
    /[%£$€]\s*\d|\b\d+(\.\d+)?\b/.test(lower) ||
    /\b(mttr|mttd|sla|uptime|availability|latency)\b/.test(lower);
  const has_tooling = TOOLING_KEYWORDS.some((tool) =>
    lower.includes(tool)
  );
  const has_scope = /\b\d+\s+(users?|sites?|services?|servers?|devices?|endpoints?|firewalls?|assets?|apps?|applications?|regions?|countries?)\b/.test(
    lower
  );
  const has_timeframe =
    /\b(weeks?|months?|quarters?|years?)\b/.test(lower) ||
    /\b(within|over|by)\s+\d+/.test(lower);
  const has_outcome = /\b(reduced|increased|improved|saved|cut|delivered|automated|streamlined|resolved|remediated|mitigated|stabilised|accelerated)\b/.test(
    lower
  );

  let score = 0;
  if (has_metric) score += 30;
  if (has_outcome) score += 25;
  if (has_tooling) score += 15;
  if (has_scope) score += 15;
  if (has_timeframe) score += 15;
  score = Math.min(score, 100);

  return {
    score,
    flags: {
      has_metric,
      has_tooling,
      has_scope,
      has_outcome,
      has_timeframe,
    },
  };
}

function trimToLength(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trim()}…`;
}

function formatDateRange(entry: WorkHistoryRecord) {
  const startLabel = formatMonthYear(entry.start_date);
  const endLabel = entry.is_current
    ? "Present"
    : entry.end_date
      ? formatMonthYear(entry.end_date)
      : "Present";
  return `${startLabel} – ${endLabel}`;
}

function formatMonthYear(value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getRecencyBoost(entry: WorkHistoryRecord) {
  if (entry.is_current) {
    return 2;
  }
  const reference = entry.end_date ?? entry.start_date;
  if (!reference) {
    return 0;
  }
  const parsed = new Date(reference);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const twoYearsMs = 1000 * 60 * 60 * 24 * 365 * 2;
  return Date.now() - parsed.getTime() <= twoYearsMs ? 1 : 0;
}

type SignalMatcher = {
  id: string;
  exactPhrases: string[];
  exactTokens: Set<string>;
  aliasTokens: Set<string>;
  overlapTokens: Set<string>;
};

type EvidenceTokens = {
  normalizedText: string;
  tokens: string[];
  tokenSet: Set<string>;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "for",
  "with",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "from",
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
  "their",
  "our",
  "your",
  "you",
  "we",
  "i",
  "role",
  "team",
  "teams",
  "project",
  "projects",
  "work",
  "working",
]);

const TOOLING_KEYWORDS = [
  "azure",
  "aws",
  "gcp",
  "cisco",
  "palo alto",
  "fortinet",
  "servicenow",
  "splunk",
  "sentinel",
  "jira",
  "confluence",
  "okta",
  "prisma",
  "zscaler",
  "qualys",
  "nessus",
  "tenable",
  "crowdstrike",
  "defender",
  "kubernetes",
  "terraform",
];

const EXTRA_ALIAS_MAP: Record<string, string[]> = {
  documentation: [
    "runbook",
    "runbooks",
    "playbook",
    "playbooks",
    "procedure",
    "procedures",
    "standard",
    "standards",
    "sop",
    "sops",
    "work instruction",
    "work instructions",
  ],
  standards: [
    "standard",
    "standards",
    "procedure",
    "procedures",
    "baseline",
    "baselines",
    "policy",
    "policies",
  ],
  runbook: [
    "runbook",
    "runbooks",
    "playbook",
    "playbooks",
    "procedure",
    "procedures",
    "sop",
    "sops",
  ],
  policy: ["policy", "policies", "governance", "compliance", "controls"],
  governance: ["policy", "policies", "compliance", "controls"],
};

function buildSignalMatchers(signals: RoleFitSignal[]) {
  const map = new Map<string, SignalMatcher>();
  signals.forEach((signal) => {
    map.set(signal.id, buildSignalMatcher(signal));
  });
  return map;
}

function buildSignalMatcher(signal: RoleFitSignal): SignalMatcher {
  const baseAliases = [signal.label, ...signal.aliases].filter(Boolean);
  const expanded = expandAliases(baseAliases);
  const exactPhrases = baseAliases
    .map((alias) => normalizeEvidenceText(alias))
    .filter(Boolean);
  const exactTokens = new Set(
    baseAliases.flatMap((alias) => tokenizeEvidence(alias))
  );
  const aliasTokens = new Set(
    expanded.flatMap((alias) => tokenizeEvidence(alias))
  );
  exactTokens.forEach((token) => aliasTokens.delete(token));
  const overlapTokens = new Set<string>();
  exactTokens.forEach((token) => overlapTokens.add(token));
  aliasTokens.forEach((token) => overlapTokens.add(token));
  return {
    id: signal.id,
    exactPhrases,
    exactTokens,
    aliasTokens,
    overlapTokens,
  };
}

function buildMatchScores(input: EvidenceTokens & { matchers: Map<string, SignalMatcher> }) {
  const scores: Record<string, number> = {};
  input.matchers.forEach((matcher, signalId) => {
    const score = scoreMatchForSignal(input, matcher);
    if (score >= 0.6) {
      scores[signalId] = score;
    }
  });
  return scores;
}

function scoreMatchForSignal(tokens: EvidenceTokens, matcher: SignalMatcher) {
  if (!tokens.normalizedText || tokens.tokens.length === 0) {
    return 0;
  }
  if (
    matcher.exactPhrases.some(
      (phrase) => phrase && tokens.normalizedText.includes(phrase)
    )
  ) {
    return 1;
  }
  if (hasAnyToken(tokens.tokenSet, matcher.exactTokens)) {
    return 1;
  }
  if (hasAnyToken(tokens.tokenSet, matcher.aliasTokens)) {
    return 0.9;
  }
  const overlap = countOverlap(tokens.tokenSet, matcher.overlapTokens);
  if (overlap >= 2) {
    return 0.6;
  }
  return 0;
}

function expandAliases(aliases: string[]) {
  const expanded = new Set<string>();
  aliases.forEach((alias) => {
    const trimmed = alias.trim();
    if (!trimmed) {
      return;
    }
    expanded.add(trimmed);
    const lowered = trimmed.toLowerCase();
    Object.entries(EXTRA_ALIAS_MAP).forEach(([key, extras]) => {
      if (lowered.includes(key)) {
        extras.forEach((extra) => expanded.add(extra));
      }
    });
  });
  return Array.from(expanded);
}

function normalizeEvidenceText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeEvidence(text: string) {
  const normalized = normalizeEvidenceText(text);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(" ")
    .map((token) => singularize(token))
    .filter((token) => token.length >= 3 && token.length <= 30)
    .filter((token) => !STOPWORDS.has(token));
}

function singularize(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("sses") || token.endsWith("ss")) {
    return token;
  }
  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function hasAnyToken(tokenSet: Set<string>, target: Set<string>) {
  let found = false;
  target.forEach((token) => {
    if (!found && tokenSet.has(token)) {
      found = true;
    }
  });
  return found;
}

function countOverlap(tokenSet: Set<string>, target: Set<string>) {
  let count = 0;
  target.forEach((token) => {
    if (tokenSet.has(token)) {
      count += 1;
    }
  });
  return count;
}
