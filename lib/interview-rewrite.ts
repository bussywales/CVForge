import { sanitizeInlineText } from "@/lib/utils/autopack-sanitize";
import type {
  InterviewPracticeBreakdown,
  InterviewPracticeFlags,
} from "@/lib/interview-practice";

export type InterviewRewriteNotes = {
  changes: string[];
  insertedPlaceholders: string[];
  structure: {
    hasS: boolean;
    hasT: boolean;
    hasA: boolean;
    hasR: boolean;
    hasMetrics: boolean;
  };
  length: {
    before: number;
    after: number;
  };
};

type RewriteInput = {
  answerText: string;
  questionText: string;
  scoreBreakdown: InterviewPracticeBreakdown;
  recommendations: string[];
  flags: InterviewPracticeFlags;
  meta?: { signals?: string[]; gaps?: string[] };
};

type SectionKey = "situation" | "task" | "action" | "result" | "metrics";

type SectionContent = {
  situation: string[];
  task: string[];
  action: string[];
  result: string[];
  metrics: string[];
};

const SECTION_TITLES: Record<SectionKey, string> = {
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
  metrics: "Metrics",
};

const WEAK_VERB_MAP: Array<[RegExp, string]> = [
  [/\bhelped\b/gi, "delivered"],
  [/\bworked on\b/gi, "implemented"],
  [/\bresponsible for\b/gi, "owned"],
  [/\bparticipated in\b/gi, "delivered"],
  [/\bassisted with\b/gi, "delivered"],
  [/\bsupported\b/gi, "delivered"],
];

const METRIC_REGEX =
  /\b\d{1,3}(?:[.,]\d{1,3})?\s*%|\b\d+\s*percent\b|£\s?\d+|\b\d+(?:\.\d+)?\s*(ms|s|secs|seconds|min|mins|minutes|hours?|days?|weeks?|months?|years?)\b|\b\d+\s*(k|m)\b/gi;

const SECURITY_TERMS = [
  "siem",
  "splunk",
  "sentinel",
  "qrader",
  "incident",
  "vulnerability",
  "patch",
  "firewall",
  "zero trust",
  "segmentation",
  "cab",
  "itil",
  "mttr",
  "sla",
  "iam",
];

const DELIVERY_TERMS = [
  "delivery",
  "programme",
  "program",
  "project",
  "stakeholder",
  "governance",
  "change",
  "risk",
  "ops",
  "operations",
  "service",
  "customer",
];

const TOOL_TERMS = [
  "azure",
  "aws",
  "gcp",
  "splunk",
  "sentinel",
  "qrader",
  "siem",
  "kubernetes",
  "terraform",
  "ansible",
  "cisco",
  "palo alto",
  "fortinet",
  "okta",
  "servicenow",
  "jira",
  "confluence",
  "intune",
  "m365",
];

const DISALLOWED_PLACEHOLDER_REGEX =
  /\b(tbd|lorem|example|needs verification|assumption|placeholder)\b/gi;

const HEADING_REGEX = /^\s*(Situation|Task|Action|Result|Metrics)\s*[:\-]\s*(.*)$/i;

export function rewriteStarAnswer(input: RewriteInput) {
  const rawAnswer = input.answerText?.trim() ?? "";
  const cleanAnswer = stripUnsafePlaceholders(rawAnswer);
  const sectionsFromAnswer = parseStarSections(cleanAnswer);
  const sections = buildSections({
    sectionsFromAnswer,
    answerText: cleanAnswer,
    flags: input.flags,
    signals: input.meta?.signals ?? [],
    gaps: input.meta?.gaps ?? [],
  });

  const notes: InterviewRewriteNotes = {
    changes: [],
    insertedPlaceholders: [],
    structure: {
      hasS: sections.situation.length > 0,
      hasT: sections.task.length > 0,
      hasA: sections.action.length > 0,
      hasR: sections.result.length > 0,
      hasMetrics: sections.metrics.length > 0,
    },
    length: {
      before: rawAnswer.length,
      after: 0,
    },
  };

  if (!sectionsFromAnswer.hasHeadings) {
    notes.changes.push("Structured the answer into STAR sections.");
  }

  if (input.flags.tooLong) {
    notes.changes.push("Compressed long sections for clarity.");
  }

  if (input.flags.missingMetrics) {
    notes.changes.push("Added metric placeholders to quantify impact.");
  }

  if (input.flags.vagueAction) {
    notes.changes.push("Strengthened ownership verbs in the Action section.");
  }

  if (input.flags.weakResult) {
    notes.changes.push("Inserted outcome framing in the Result section.");
  }

  const improvedText = formatSections(sections, notes);
  notes.length.after = improvedText.length;

  return {
    improvedText,
    notes,
  };
}

export function extractKeyDetails(answerText: string) {
  const lower = answerText.toLowerCase();
  const tools = TOOL_TERMS.filter((term) => lower.includes(term));
  const metrics = Array.from(new Set(answerText.match(METRIC_REGEX) ?? []));
  const timelines = extractTimelines(answerText);
  return {
    tools: uniqByValue(tools.map((term) => titleCase(term))),
    metrics,
    timelines,
  };
}

function parseStarSections(text: string) {
  const lines = text.split(/\r?\n/);
  const sections: Record<SectionKey, string[]> = {
    situation: [],
    task: [],
    action: [],
    result: [],
    metrics: [],
  };
  let current: SectionKey | null = null;
  let hasHeadings = false;

  lines.forEach((line) => {
    const match = line.match(HEADING_REGEX);
    if (match) {
      const heading = match[1].toLowerCase() as SectionKey;
      if (heading in sections) {
        current = heading;
        hasHeadings = true;
        const remainder = match[2]?.trim();
        if (remainder) {
          sections[current].push(remainder);
        }
        return;
      }
    }
    if (current) {
      sections[current].push(line);
    }
  });

  return { sections, hasHeadings };
}

function buildSections(input: {
  sectionsFromAnswer: ReturnType<typeof parseStarSections>;
  answerText: string;
  flags: InterviewPracticeFlags;
  signals: string[];
  gaps: string[];
}): SectionContent {
  const cleaned = stripUnsafePlaceholders(input.answerText);
  const sentences = splitSentences(cleaned);
  const resultSentences = sentences.filter((sentence) => hasResultCue(sentence));
  const contextSentences = sentences.filter((sentence) => hasContextCue(sentence));
  const taskSentences = sentences.filter((sentence) => hasTaskCue(sentence));

  const details = extractKeyDetails(input.answerText);

  const baseSections = input.sectionsFromAnswer.sections;

  const situation = buildSectionLines({
    rawLines: baseSections.situation,
    fallback: contextSentences.length ? contextSentences : sentences.slice(0, 2),
    defaultLine: "Context: add the situation, stakeholders, and constraints.",
  });

  const task = buildSectionLines({
    rawLines: baseSections.task,
    fallback: taskSentences.length ? taskSentences : sentences.slice(2, 3),
    defaultLine: "Objective: add the goal you were responsible for delivering.",
  });

  const actionLines = buildSectionLines({
    rawLines: baseSections.action,
    fallback: sentences.slice(3, 6),
    defaultLine: "I led the workstream, coordinating delivery and stakeholders.",
  });

  const action = strengthenLines(addDetailsToAction(actionLines, details));

  const resultLines = buildSectionLines({
    rawLines: baseSections.result,
    fallback: resultSentences.length ? resultSentences : sentences.slice(6),
    defaultLine: "Outcome: summarise the impact on risk, delivery, or service quality.",
  });

  const result = strengthenLines(addOutcomePlaceholders(resultLines, input.flags));

  const metrics = buildMetricsSection({
    rawLines: baseSections.metrics,
    answerText: input.answerText,
    flags: input.flags,
    signals: input.signals,
    gaps: input.gaps,
  });

  return {
    situation: compressLines(strengthenLines(situation), input.flags.tooLong),
    task: compressLines(strengthenLines(task), input.flags.tooLong),
    action: compressLines(action, input.flags.tooLong),
    result: compressLines(result, input.flags.tooLong),
    metrics: compressLines(metrics, input.flags.tooLong),
  };
}

function buildSectionLines(input: {
  rawLines: string[];
  fallback: string[];
  defaultLine: string;
}) {
  const cleaned = cleanLines(input.rawLines);
  if (cleaned.length) {
    return cleaned;
  }

  const fallback = cleanLines(input.fallback);
  if (fallback.length) {
    return fallback;
  }

  return [input.defaultLine];
}

function buildMetricsSection(input: {
  rawLines: string[];
  answerText: string;
  flags: InterviewPracticeFlags;
  signals: string[];
  gaps: string[];
}) {
  const cleaned = cleanLines(input.rawLines);
  if (cleaned.length) {
    return cleaned;
  }

  const metricSentences = extractMetricSentences(input.answerText);
  const metrics = metricSentences.length ? metricSentences : [];

  if (input.flags.missingMetrics || metrics.length === 0) {
    const placeholders = selectMetricPlaceholders(
      [...input.signals, ...input.gaps].join(" ")
    );
    const needed = input.flags.missingMetrics ? 3 : 2;
    const chosen = placeholders.slice(0, Math.min(needed, placeholders.length));
    metrics.push(...chosen);
  }

  return metrics.length ? metrics : ["Add 1-2 metrics to quantify the impact."];
}

function addDetailsToAction(lines: string[], details: ReturnType<typeof extractKeyDetails>) {
  const updated = [...lines];
  if (details.tools.length) {
    updated.push(`Tools: ${details.tools.join(", ")}.`);
  }
  if (details.timelines.length) {
    updated.push(`Timeline: ${details.timelines.join(", ")}.`);
  }
  if (!containsOwnershipVerb(updated.join(" "))) {
    updated.unshift("I led the delivery, coordinating stakeholders and execution.");
  }
  return updated;
}

function addOutcomePlaceholders(lines: string[], flags: InterviewPracticeFlags) {
  const updated = [...lines];
  if (flags.weakResult) {
    updated.push("Outcome: reduced [X] and improved [Y] in the target area.");
  }
  return updated;
}

function formatSections(sections: SectionContent, notes: InterviewRewriteNotes) {
  const output: string[] = [];
  const placeholderLines: string[] = [];

  (Object.keys(SECTION_TITLES) as SectionKey[]).forEach((key) => {
    output.push(`${SECTION_TITLES[key]}:`);
    const lines = sections[key].length ? sections[key] : ["Add detail here."];
    lines.forEach((line) => {
      const cleaned = stripUnsafePlaceholders(line);
      if (cleaned) {
        output.push(`- ${cleaned}`);
        if (/\[(X|Y|Z)\]/i.test(cleaned)) {
          placeholderLines.push(cleaned);
        }
      }
    });
    output.push("");
  });

  const improved = output.join("\n").trim();
  notes.insertedPlaceholders.push(...uniqByValue(placeholderLines));

  return improved;
}

function extractMetricSentences(text: string) {
  const metricRegex = new RegExp(METRIC_REGEX.source, "i");
  const sentences = splitSentences(text);
  return cleanLines(
    sentences.filter((sentence) => metricRegex.test(sentence))
  );
}

function splitSentences(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  return normalized.split(/(?<=[.!?])\s+/);
}

function cleanLines(lines: string[]) {
  return lines
    .map((line) => sanitizeInlineText(stripUnsafePlaceholders(line)))
    .map((line) => line.replace(/^[\-•*]\s*/, ""))
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function strengthenLines(lines: string[]) {
  return lines.map((line) => strengthenVerbs(line));
}

function strengthenVerbs(text: string) {
  let updated = text;
  WEAK_VERB_MAP.forEach(([pattern, replacement]) => {
    updated = updated.replace(pattern, replacement);
  });
  return updated;
}

function compressLines(lines: string[], shouldCompress: boolean) {
  if (!shouldCompress) {
    return lines;
  }
  const limited = lines.slice(0, 4).map((line) => {
    if (line.length <= 400) {
      return line;
    }
    return `${line.slice(0, 397)}...`;
  });
  return limited;
}

function stripUnsafePlaceholders(text: string) {
  let cleaned = text.replace(DISALLOWED_PLACEHOLDER_REGEX, "");
  cleaned = cleaned.replace(/\[(?![XYZ]\])[^[\]]+\]/g, "");
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

function selectMetricPlaceholders(context: string) {
  const lower = context.toLowerCase();
  const isSecurity = SECURITY_TERMS.some((term) => lower.includes(term));
  const isDelivery = DELIVERY_TERMS.some((term) => lower.includes(term));

  if (isSecurity) {
    return [
      "Reduced incident response time by [X]% and improved MTTR to [Y] mins.",
      "Closed [X] critical vulnerabilities within [Y] days.",
      "Cut high-risk firewall exceptions by [X]% within [Y] weeks.",
      "Improved SLA compliance to [X]% and reduced repeat incidents by [Y]%.",
    ];
  }

  if (isDelivery) {
    return [
      "Delivered the programme [X]% ahead of plan while maintaining quality.",
      "Reduced cycle time by [X]% and improved on-time delivery to [Y]%.",
      "Cut handover delays by [X]% and raised stakeholder satisfaction to [Y]%.",
      "Removed [X] hours per week through streamlined workflows.",
    ];
  }

  return [
    "Improved performance by [X]% within [Y] weeks.",
    "Reduced cost or risk by [X]% and delivered [Y] measurable outcomes.",
    "Saved [X] hours per week through process improvements.",
    "Improved service quality to [X]% and reduced defects by [Y]%.",
  ];
}

function hasResultCue(sentence: string) {
  return /\b(reduced|increased|improved|saved|achieved|cut|lowered|uptime|sla|mttr|risk)\b/i.test(
    sentence
  );
}

function hasContextCue(sentence: string) {
  return /\b(situation|context|background|challenge|stakeholder|environment|when)\b/i.test(
    sentence
  );
}

function hasTaskCue(sentence: string) {
  return /\b(task|goal|objective|responsible|responsibility|aim|needed to|asked to)\b/i.test(
    sentence
  );
}

function containsOwnershipVerb(text: string) {
  return /\b(led|delivered|implemented|reduced|automated|designed|migrated|remediated|improved|owned|created|launched|secured|coordinated|resolved|triaged|deployed|streamlined|saved)\b/i.test(
    text
  );
}

function extractTimelines(text: string) {
  const matches = text.match(/\b\d{1,2}\s*(days?|weeks?|months?|years?)\b/gi) ?? [];
  return uniqByValue(matches.map((value) => value.toLowerCase()));
}

function uniqByValue(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  });
  return result;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
