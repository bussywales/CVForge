import { scoreEvidenceQuality } from "@/lib/evidence";

export type StarEvidenceInput = {
  evidenceId: string;
  sourceId?: string | null;
  title: string;
  text: string;
  qualityScore?: number | null;
  hasMetric?: boolean;
};

export type StarDraftPrefill = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  evidenceIds: string[];
  qualityHint: string;
};

type PrefillInput = {
  gapKey: string;
  gapLabel: string;
  evidence: StarEvidenceInput[];
  profileHeadline?: string | null;
};

const METRIC_PATTERN =
  /(%|£|\b\d+(\.\d+)?\b|\b(mttr|mttd|sla|uptime|availability|latency)\b|\b(days?|weeks?|months?|hours?|mins?)\b)/i;

export function buildStarDraftPrefill({
  gapKey,
  gapLabel,
  evidence,
  profileHeadline,
}: PrefillInput): StarDraftPrefill {
  const safeLabel = gapLabel?.trim() || gapKey || "role evidence";
  const orderedEvidence = evidence.slice(0, 3);
  const evidenceIds = Array.from(
    new Set(
      orderedEvidence
        .map((item) => item.sourceId)
        .filter((value): value is string => Boolean(value))
    )
  );

  const situationParts: string[] = [];
  if (profileHeadline) {
    situationParts.push(profileHeadline.trim());
  }
  if (orderedEvidence[0]?.title) {
    situationParts.push(`Example from ${orderedEvidence[0].title}.`);
  }
  if (!situationParts.length) {
    situationParts.push(`Context relevant to ${safeLabel}.`);
  }
  const situation = normalizeSentence(`Context: ${situationParts.join(" ")}`);

  const task = normalizeSentence(
    `Task: Deliver ${safeLabel} outcomes while meeting service expectations.`
  );

  const actionLines = orderedEvidence.length
    ? orderedEvidence.map((item) => `- ${trimToLength(item.text, 200)}`)
    : [`- Delivered ${safeLabel} using agreed processes and clear ownership.`];
  const action = actionLines.join("\n");

  const metricEvidence =
    orderedEvidence.find((item) => item.hasMetric) ??
    orderedEvidence.find((item) => METRIC_PATTERN.test(item.text)) ??
    null;
  const resultText = metricEvidence
    ? trimToLength(metricEvidence.text, 200)
    : `Improved ${safeLabel} outcomes with measurable impact and stakeholder confidence.`;
  const result = normalizeSentence(`Result: ${resultText}`);

  const avgQuality = averageQualityScore(orderedEvidence);
  const qualityHint = avgQuality >= 75 ? "Strong" : avgQuality >= 50 ? "Medium" : "Weak";

  return {
    title: titleCase(safeLabel),
    situation,
    task,
    action,
    result,
    evidenceIds,
    qualityHint,
  };
}

export function formatStarDraft({
  situation,
  task,
  action,
  result,
}: Pick<StarDraftPrefill, "situation" | "task" | "action" | "result">) {
  return [
    `Situation: ${stripPrefix(situation, "Situation:")}`,
    `Task: ${stripPrefix(task, "Task:")}`,
    `Action: ${stripPrefix(action, "Action:")}`,
    `Result: ${stripPrefix(result, "Result:")}`,
  ].join("\n");
}

export function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function deriveEvidenceQuality(text: string) {
  return scoreEvidenceQuality(text).score;
}

function averageQualityScore(items: StarEvidenceInput[]) {
  if (!items.length) {
    return 0;
  }
  const total = items.reduce((sum, item) => {
    const score = item.qualityScore ?? deriveEvidenceQuality(item.text);
    return sum + score;
  }, 0);
  return Math.round(total / items.length);
}

function trimToLength(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trim()}…`;
}

function normalizeSentence(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripPrefix(value: string, prefix: string) {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim();
  }
  return trimmed;
}
