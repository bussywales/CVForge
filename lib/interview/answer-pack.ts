export type AnswerPackQuestionType =
  | "tell_me_about_yourself"
  | "why_this_role"
  | "why_us"
  | "strengths"
  | "weaknesses"
  | "conflict"
  | "pressure"
  | "stakeholder_management"
  | "technical_incident"
  | "project_delivery"
  | "leadership"
  | "change_management"
  | "security_risk"
  | "general_star";

export type AnswerPackVariant = "standard" | "short90";

export type StarDraftSource = {
  id: string;
  gap_key: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quality_hint?: string | null;
  updated_at?: string | null;
};

export type AnswerPackResult = {
  answerText: string;
  used: {
    starLibraryId: string;
    gapKey: string;
    title: string;
  };
};

const PLACEHOLDER_PATTERN =
  /\b(tbd|todo|lorem|assumption|needs verification|example)\b/gi;

const METRIC_PATTERN =
  /(%|£|\b\d+(\.\d+)?\b|\b(mttr|mttd|sla|uptime|availability|latency)\b|\b(days?|weeks?|months?|hours?|mins?)\b)/i;

const TYPE_HINTS: Array<[AnswerPackQuestionType, RegExp]> = [
  ["tell_me_about_yourself", /tell me about yourself|introduce yourself/i],
  ["why_this_role", /why (this|the) role|why are you interested/i],
  ["why_us", /why (us|our company|this organisation)/i],
  ["strengths", /strengths?|what are you good at/i],
  ["weaknesses", /weaknesses?|development area|improve on/i],
  ["conflict", /conflict|disagreement/i],
  ["pressure", /pressure|stress|tight deadline/i],
  ["stakeholder_management", /stakeholder/i],
  ["technical_incident", /incident|outage|major incident/i],
  ["project_delivery", /project|delivery|programme/i],
  ["leadership", /lead|leadership|managed team/i],
  ["change_management", /change management|change control|cab/i],
  ["security_risk", /risk|security|vulnerability/i],
];

const TYPE_INTROS: Record<AnswerPackQuestionType, string> = {
  tell_me_about_yourself:
    "I specialise in delivering outcomes in this area, and a recent example shows how I work.",
  why_this_role:
    "This role appeals because it needs strong delivery in this area, which I have demonstrated.",
  why_us:
    "I am drawn to organisations that focus on this area, and I have relevant experience to contribute.",
  strengths:
    "A key strength of mine is delivering outcomes in this area, backed by evidence.",
  weaknesses:
    "An area I actively manage is balancing pace with rigour; I have learned to improve this through experience.",
  conflict:
    "When conflict arises, I focus on shared outcomes and clear communication; here is an example.",
  pressure:
    "Under pressure I prioritise and communicate clearly; here is a relevant example.",
  stakeholder_management:
    "I manage stakeholders by aligning expectations and keeping updates clear; here is an example.",
  technical_incident:
    "In incidents I follow structured triage and clear communication; here is an example.",
  project_delivery:
    "I deliver projects by planning, owning risks, and tracking outcomes; here is an example.",
  leadership:
    "I lead by setting direction and supporting delivery; here is an example.",
  change_management:
    "I manage change through risk control and approvals; here is an example.",
  security_risk:
    "I reduce risk by implementing controls and measuring impact; here is an example.",
  general_star: "Here is a relevant example:",
};

const QUALITY_ORDER: Record<string, number> = {
  Strong: 3,
  Medium: 2,
  Weak: 1,
};

export function inferQuestionType(
  questionText: string,
  signals: string[] = []
): AnswerPackQuestionType {
  const lower = questionText.toLowerCase();
  for (const [type, pattern] of TYPE_HINTS) {
    if (pattern.test(lower)) {
      return type;
    }
  }

  const signalText = signals.join(" ").toLowerCase();
  if (signalText.includes("incident")) return "technical_incident";
  if (signalText.includes("change") || signalText.includes("cab")) {
    return "change_management";
  }
  if (signalText.includes("stakeholder")) return "stakeholder_management";
  if (signalText.includes("risk") || signalText.includes("security")) {
    return "security_risk";
  }
  if (signalText.includes("lead")) return "leadership";
  if (signalText.includes("project")) return "project_delivery";

  return "general_star";
}

export function selectStarDraft(
  drafts: StarDraftSource[],
  gapKey?: string | null
): StarDraftSource | null {
  if (!drafts.length) {
    return null;
  }
  if (gapKey) {
    const exact = drafts.find((draft) => draft.gap_key === gapKey);
    if (exact) {
      return exact;
    }
  }
  return drafts
    .slice()
    .sort((a, b) => {
      const aScore = QUALITY_ORDER[a.quality_hint ?? "Medium"] ?? 0;
      const bScore = QUALITY_ORDER[b.quality_hint ?? "Medium"] ?? 0;
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    })[0];
}

export function buildAnswer({
  type,
  starDraft,
  short90,
}: {
  type: AnswerPackQuestionType;
  starDraft: StarDraftSource;
  short90: boolean;
}): AnswerPackResult {
  const intro = TYPE_INTROS[type] ?? TYPE_INTROS.general_star;
  const introLine = short90 ? "Quick example:" : intro;
  const situation = cleanText(starDraft.situation);
  const task = cleanText(starDraft.task);
  const action = cleanText(starDraft.action);
  const result = cleanText(starDraft.result);

  const situationLine = short90
    ? trimToSentence(situation, 1)
    : trimToSentence(situation, 2);
  const taskLine = short90 ? trimToSentence(task, 1) : trimToSentence(task, 2);

  const actionLines = extractActionLines(action);
  const actionBlock = short90
    ? formatBulletLines(actionLines, 2)
    : formatActionSentence(actionLines);

  const resultLine = buildResultLine(result, action, short90);

  const sections = [
    introLine,
    `Situation: ${ensureSentence(situationLine || fallbackSituation())}`,
    `Task: ${ensureSentence(taskLine || fallbackTask())}`,
    short90 ? `Action:\n${actionBlock}` : `Action: ${actionBlock}`,
    `Result: ${ensureSentence(resultLine || fallbackResult())}`,
  ];

  let answerText = sections.filter(Boolean).join("\n");

  if (short90) {
    answerText = trimToLength(answerText, 900);
  }

  answerText = answerText.replace(PLACEHOLDER_PATTERN, "").replace(/[ \t]+\n/g, "\n").trim();

  return {
    answerText,
    used: {
      starLibraryId: starDraft.id,
      gapKey: starDraft.gap_key,
      title: starDraft.title,
    },
  };
}

function cleanText(value: string) {
  return value
    .replace(/\[[^\]]+]/g, "")
    .replace(PLACEHOLDER_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToSentence(value: string, maxSentences: number) {
  if (!value) {
    return "";
  }
  const parts = value.split(/(?<=[.!?])\s+/);
  return parts.slice(0, maxSentences).join(" ").trim();
}

function extractActionLines(value: string) {
  if (!value) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .flatMap((line) => line.split(/;\s+/))
    .map((line) => line.replace(/^\s*[-*\u2022]\s+/, "").trim())
    .filter(Boolean);
}

function formatBulletLines(lines: string[], max: number) {
  const trimmed = lines.length ? lines : [fallbackAction()];
  return trimmed
    .slice(0, max)
    .map((line) => `- ${ensureFirstPerson(line)}`)
    .join("\n");
}

function formatActionSentence(lines: string[]) {
  const trimmed = lines.length ? lines : [fallbackAction()];
  const sentences = trimmed.map((line) => ensureSentence(ensureFirstPerson(line)));
  return sentences.join(" ");
}

function buildResultLine(result: string, action: string, short90: boolean) {
  const metricLine = findMetricSentence(result) || findMetricSentence(action);
  if (metricLine) {
    return short90
      ? trimToSentence(metricLine, 1)
      : ensureSentence(metricLine);
  }
  return result;
}

function findMetricSentence(value: string) {
  if (!value) {
    return "";
  }
  const lines = value.split(/(?<=[.!?])\s+/);
  return lines.find((line) => METRIC_PATTERN.test(line)) ?? "";
}

function ensureFirstPerson(value: string) {
  const trimmed = value.trim();
  if (/^(i|my|we)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `I ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function trimToLength(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trim()}…`;
}

function fallbackSituation() {
  return "I was working in a role where this capability was essential.";
}

function fallbackTask() {
  return "My task was to deliver outcomes while meeting service expectations.";
}

function fallbackAction() {
  return "delivered the work using agreed processes and clear ownership";
}

function fallbackResult() {
  return "I improved outcomes and stakeholder confidence.";
}
