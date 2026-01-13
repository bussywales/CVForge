import { sanitizeInlineText, sanitizeTextContent } from "@/lib/utils/autopack-sanitize";
import type { InterviewLiftResult } from "@/lib/interview-lift";
import type { RoleFitResult, RoleFitSignalGap, RoleFitSignalMatch } from "@/lib/role-fit";
import { extractTopTerms } from "@/lib/jd-learning";

export type InterviewPackQuestion = {
  question: string;
  signals: string[];
  starPrompt: string;
  priority: "high" | "medium" | "low";
  source: "gap" | "signal" | "core";
};

export type InterviewPackWeakSpot = {
  id: string;
  label: string;
  actionSuggestion: string;
  metricSuggestions: string[];
  source: "gap" | "lift";
  allowEvidence: boolean;
};

export type InterviewPack = {
  roleSnapshot: string[];
  questions: InterviewPackQuestion[];
  weakSpots: InterviewPackWeakSpot[];
  prepChecklist: string[];
};

export type InterviewPackInput = {
  jobTitle?: string | null;
  company?: string | null;
  jobDescription: string;
  roleFit: RoleFitResult;
  interviewLift: InterviewLiftResult;
};

const RESPONSIBILITY_HINTS = [
  "lead",
  "manage",
  "deliver",
  "own",
  "responsible",
  "support",
  "design",
  "implement",
  "build",
  "drive",
  "coordinate",
  "collaborate",
  "maintain",
  "monitor",
  "improve",
  "analyse",
  "analyze",
  "assess",
  "ensure",
  "develop",
  "plan",
  "operate",
  "govern",
  "report",
  "review",
  "resolve",
];

const CORE_QUESTION_BANK = [
  "How have you prioritised competing demands when several stakeholders wanted outcomes at the same time?",
  "Tell me about a time you led delivery across teams with tight deadlines.",
  "Describe a situation where you influenced senior stakeholders to secure a decision.",
  "How do you manage risk when making changes in a live environment?",
  "Walk me through a time you improved a process and the impact it had.",
  "Tell me about a difficult incident or problem you resolved and how you handled it.",
  "How do you communicate progress and blockers to non-technical audiences?",
  "Describe a time you balanced quality with speed and what trade-offs you made.",
  "Tell me about a time you took ownership of a service outcome.",
];

const PREP_CHECKLIST = [
  "Research the organisation and current priorities (news, strategy, recent changes).",
  "Align 3–5 achievements directly to the role signals and gaps.",
  "Quantify impact with clear metrics (time, cost, volume, risk reduction).",
  "Prepare concise STAR stories for the top questions.",
  "List thoughtful questions to ask the interviewer.",
  "Confirm interview logistics, format, and attendees.",
];

const BULLET_REGEX = /^\s*(?:[-*\u2022]|\d+\.)\s+(.*)$/;

export function buildInterviewPack(input: InterviewPackInput): InterviewPack {
  const jobDescription = sanitizeTextContent(input.jobDescription || "");
  const roleSnapshot = extractRoleSnapshot(jobDescription);

  const gapSignals = input.roleFit.gapSignals.slice(0, 6);
  const matchedSignals = input.roleFit.matchedSignals.slice(0, 6);

  const gapQuestions = gapSignals.map((gap) => buildGapQuestion(gap));
  const signalQuestions = matchedSignals.map((signal) =>
    buildSignalQuestion(signal)
  );
  const coreQuestions = CORE_QUESTION_BANK.map((question) =>
    buildCoreQuestion(question)
  );

  let questions = dedupeQuestions([
    ...gapQuestions,
    ...signalQuestions,
    ...coreQuestions,
  ]);

  if (questions.length < 10) {
    const fallbackTerms = extractTopTerms(jobDescription).slice(0, 5);
    fallbackTerms.forEach((term) => {
      questions.push(buildFallbackQuestion(term));
    });
    questions = dedupeQuestions(questions);
  }

  if (questions.length < 10) {
    const extraCore = CORE_QUESTION_BANK.map((question) =>
      buildCoreQuestion(question)
    );
    questions = dedupeQuestions([...questions, ...extraCore]);
  }

  questions = questions.slice(0, 15);

  const weakSpots = buildWeakSpots(gapSignals, input.interviewLift);

  return {
    roleSnapshot,
    questions,
    weakSpots,
    prepChecklist: PREP_CHECKLIST.slice(),
  };
}

function extractRoleSnapshot(jobDescription: string): string[] {
  if (!jobDescription.trim()) {
    return [];
  }

  const lines = jobDescription.split(/\r?\n/).map((line) => line.trim());
  const bulletLines = lines
    .map((line) => {
      const match = line.match(BULLET_REGEX);
      if (!match) {
        return null;
      }
      return cleanLine(match[1]);
    })
    .filter(Boolean) as string[];

  const snapshot = pickResponsibilityLines(bulletLines);

  if (snapshot.length >= 5) {
    return snapshot.slice(0, 7);
  }

  const sentenceCandidates = jobDescription
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => cleanLine(line))
    .filter(Boolean);

  const sentenceSnapshot = pickResponsibilityLines(sentenceCandidates);

  return [...snapshot, ...sentenceSnapshot]
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 7);
}

function pickResponsibilityLines(lines: string[]) {
  return lines
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .filter((line) => line.length >= 24 && line.length <= 180)
    .filter((line) => isResponsibilityLine(line))
    .filter((line, index, array) => array.indexOf(line) === index);
}

function isResponsibilityLine(line: string) {
  const lower = line.toLowerCase();
  return RESPONSIBILITY_HINTS.some((hint) => lower.includes(hint));
}

function buildGapQuestion(gap: RoleFitSignalGap): InterviewPackQuestion {
  const label = gap.label;
  const question = `What evidence can you share that demonstrates ${label}?`;
  const suggestion = gap.primaryAction || gap.actionSuggestions[0] || "";
  const starPrompt = buildStarPrompt({
    label,
    suggestion,
    isGap: true,
  });
  return {
    question,
    signals: buildSignalTags(gap),
    starPrompt,
    priority: "high",
    source: "gap",
  };
}

function buildSignalQuestion(signal: RoleFitSignalMatch): InterviewPackQuestion {
  const label = signal.label;
  const question = `Tell me about a time you demonstrated ${label}.`;
  const starPrompt = buildStarPrompt({ label, isGap: false });
  return {
    question,
    signals: buildSignalTags(signal),
    starPrompt,
    priority: "medium",
    source: "signal",
  };
}

function buildCoreQuestion(question: string): InterviewPackQuestion {
  return {
    question: cleanLine(question),
    signals: ["Core"],
    starPrompt: buildStarPrompt({ label: "this" }),
    priority: "low",
    source: "core",
  };
}

function buildFallbackQuestion(term: string): InterviewPackQuestion {
  const label = titleCase(term);
  const question = `How have you applied ${label} in previous work?`;
  const starPrompt = buildStarPrompt({ label, isGap: true });
  return {
    question,
    signals: [`JD term: ${label}`],
    starPrompt,
    priority: "high",
    source: "gap",
  };
}

function buildSignalTags(signal: { label: string; packLabel: string; source: string }) {
  const tags = [signal.label];
  if (signal.packLabel) {
    tags.push(signal.packLabel);
  }
  if (signal.source === "fallback" && !tags.includes("JD terms")) {
    tags.push("JD terms");
  }
  return tags;
}

function buildStarPrompt({
  label,
  suggestion,
  isGap = false,
}: {
  label: string;
  suggestion?: string;
  isGap?: boolean;
}) {
  const safeLabel = sanitizeInlineText(label || "this");
  const safeSuggestion = suggestion ? sanitizeInlineText(suggestion) : "";
  const actionLine = isGap && safeSuggestion
    ? `Action: Use evidence like “${safeSuggestion}”.`
    : isGap
      ? `Action: Describe what you did to demonstrate ${safeLabel}.`
      : `Action: Focus on how you delivered ${safeLabel}.`;

  return [
    `Situation: Set the context where ${safeLabel} mattered.`,
    "Task: Explain your responsibility and constraints.",
    actionLine,
    "Result: Share the outcome and impact.",
    "Metrics: Quantify time, cost, risk, or quality gains.",
  ].join("\n");
}

function buildWeakSpots(
  gaps: RoleFitSignalGap[],
  interviewLift: InterviewLiftResult
): InterviewPackWeakSpot[] {
  const spots: InterviewPackWeakSpot[] = gaps.map((gap) => ({
    id: gap.id,
    label: gap.label,
    actionSuggestion: gap.primaryAction || gap.actionSuggestions[0] || "",
    metricSuggestions: gap.metricSuggestions.slice(0, 2),
    source: "gap",
    allowEvidence: true,
  }));

  if (spots.length < 3) {
    const evidenceAction = interviewLift.actions.find(
      (action) => action.id === "add_evidence"
    );
    if (evidenceAction && evidenceAction.description) {
      const label =
        evidenceAction.gap?.label ||
        evidenceAction.fallbackTerm ||
        "Role evidence";
      if (!spots.find((spot) => spot.label === label)) {
        spots.push({
          id: `lift-${label.toLowerCase().replace(/\s+/g, "-")}`,
          label,
          actionSuggestion:
            evidenceAction.actionSuggestion ||
            `Add evidence for ${label}.`,
          metricSuggestions: [],
          source: "lift",
          allowEvidence: true,
        });
      }
    }

    const metricAction = interviewLift.actions.find(
      (action) => action.id === "add_metric"
    );
    if (metricAction && metricAction.metricSuggestions?.length) {
      const label = "Metrics impact";
      if (!spots.find((spot) => spot.label === label)) {
        spots.push({
          id: "lift-metric",
          label,
          actionSuggestion: metricAction.description || "Add a clear impact metric.",
          metricSuggestions: metricAction.metricSuggestions.slice(0, 2),
          source: "lift",
          allowEvidence: false,
        });
      }
    }
  }

  return spots.slice(0, 6);
}

function dedupeQuestions(questions: InterviewPackQuestion[]) {
  const seen = new Set<string>();
  const result: InterviewPackQuestion[] = [];

  questions.forEach((question) => {
    const key = normaliseKey(question.question);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push({
      ...question,
      question: cleanLine(question.question),
      starPrompt: cleanStarPrompt(question.starPrompt),
    });
  });

  return result;
}

function normaliseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanStarPrompt(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => sanitizeInlineText(line))
    .filter(Boolean)
    .join("\n");
}

function cleanLine(value: string) {
  return sanitizeInlineText(value).replace(/[\s]+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
