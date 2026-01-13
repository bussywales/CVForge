import type {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
} from "docx";
import { createRequire } from "module";
import type { ProfileRecord } from "@/lib/data/profile";
import type { WorkHistoryRecord } from "@/lib/data/work-history";
import type { InterviewPack } from "@/lib/interview-pack";
import type { ExportVariant } from "@/lib/export/export-utils";
import { buildContactLine, extractLinkedIn, extractPhone } from "@/lib/export/contact";
import { sanitizeInlineText } from "@/lib/utils/autopack-sanitize";

type ParsedSection = {
  key: string;
  title?: string;
  lines: string[];
  bullets: string[];
};

type ParsedCv = {
  summaryParagraphs: string[];
  achievements: string[];
  remainingSections: Array<{
    title?: string;
    paragraphs: string[];
    bullets: string[];
  }>;
};

type DocxModule = typeof import("docx");

const require = createRequire(import.meta.url);
let docxModule: DocxModule | null = null;

function getDocxModule() {
  if (!docxModule) {
    docxModule = require("docx") as DocxModule;
  }
  return docxModule;
}

type HeadingValue =
  | "Heading1"
  | "Heading2"
  | "Title"
  | "Heading3"
  | "Heading4"
  | "Heading5"
  | "Heading6";

function resolveHeadingLevels() {
  const docx = getDocxModule();
  const heading = (docx as unknown as { HeadingLevel?: Record<string, string> })
    .HeadingLevel;
  const titleHeading = (heading?.TITLE ??
    heading?.HEADING_1 ??
    "Heading1") as HeadingValue;
  const sectionHeading = (heading?.HEADING_2 ??
    heading?.HEADING_1 ??
    "Heading2") as HeadingValue;

  return { titleHeading, sectionHeading };
}

const SUMMARY_KEYS = [
  "profile",
  "summary",
  "professional summary",
  "personal statement",
];

const ACHIEVEMENT_KEYS = [
  "key achievements",
  "achievements",
  "key highlights",
  "impact highlights",
];

const BULLET_REGEX = /^\s*(?:[-*\u2022]|\d+\.)\s+(.*)$/;

const KNOWN_HEADINGS = new Set([
  ...SUMMARY_KEYS,
  ...ACHIEVEMENT_KEYS,
  "experience",
  "employment",
  "education",
  "skills",
  "projects",
  "certifications",
  "awards",
  "volunteering",
  "interests",
  "additional information",
  "additional info",
  "career highlights",
  "key skills",
]);

const SIGN_OFF_PREFIXES = [
  "kind regards",
  "regards",
  "best regards",
  "yours sincerely",
  "yours faithfully",
  "sincerely",
];
const METRIC_REGEX =
  /(\d|%|£|\$|€|\b(hours?|hrs?|days?|weeks?|months?|years?|mins?|minutes?|seconds?)\b|\b(kpi|sla)\b)/i;

function normalizeHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanLine(value: string) {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*>+\s?/, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimMetricLine(line: string, maxLength = 120) {
  if (line.length <= maxLength) {
    return line;
  }
  if (!METRIC_REGEX.test(line)) {
    return line;
  }
  const trimmed = line.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  return `${trimmed}...`;
}

export function extractBulletLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(BULLET_REGEX);
      if (!match) {
        return null;
      }
      const cleaned = cleanLine(match[1]);
      return cleaned || null;
    })
    .filter(Boolean) as string[];
}

function detectHeading(cleaned: string, rawLine: string) {
  const normalized = normalizeHeading(cleaned);
  if (!normalized) {
    return null;
  }

  const isKnown = KNOWN_HEADINGS.has(normalized);
  const rawTrimmed = rawLine.trim();
  const isUppercase =
    rawTrimmed.length > 0 && rawTrimmed === rawTrimmed.toUpperCase();
  const hasColon = rawTrimmed.endsWith(":");

  if (!isKnown && !isUppercase && !hasColon) {
    return null;
  }

  const title =
    isUppercase || hasColon ? titleCase(cleaned) : cleaned.trim();
  return { key: normalized, title: title.replace(/:$/, "") };
}

function splitParagraphs(lines: string[]) {
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (current.length > 0) {
        paragraphs.push(current.join(" ").trim());
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    paragraphs.push(current.join(" ").trim());
  }

  return paragraphs.filter(Boolean);
}

function parseCvText(cvText: string): ParsedCv {
  const sections = new Map<string, ParsedSection>();
  const ensureSection = (key: string, title?: string) => {
    if (!sections.has(key)) {
      sections.set(key, {
        key,
        title,
        lines: [],
        bullets: [],
      });
    }
    return sections.get(key)!;
  };

  let currentKey = "body";
  ensureSection(currentKey);

  const rawLines = cvText.split(/\r?\n/);

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      ensureSection(currentKey).lines.push("");
      continue;
    }

    const bulletMatch = rawLine.match(BULLET_REGEX);
    if (bulletMatch) {
      const bulletText = cleanLine(bulletMatch[1]);
      if (bulletText) {
        ensureSection(currentKey).bullets.push(bulletText);
      }
      continue;
    }

    const cleaned = cleanLine(rawLine);
    if (!cleaned) {
      continue;
    }

    const heading = detectHeading(cleaned, rawLine);
    if (heading) {
      currentKey = heading.key;
      ensureSection(currentKey, heading.title);
      continue;
    }

    ensureSection(currentKey).lines.push(cleaned);
  }

  const findSectionKey = (keys: string[]) =>
    keys.find((key) => sections.has(key)) ?? null;

  const summaryKey = findSectionKey(SUMMARY_KEYS);
  const achievementKey = findSectionKey(ACHIEVEMENT_KEYS);
  const bodySection = sections.get("body");
  const bodyParagraphs = bodySection
    ? splitParagraphs(bodySection.lines)
    : [];

  let summaryParagraphs: string[] = [];
  let remainingBodyParagraphs = bodyParagraphs;

  if (summaryKey && sections.get(summaryKey)) {
    summaryParagraphs = splitParagraphs(sections.get(summaryKey)!.lines);
  } else if (bodyParagraphs.length > 0) {
    summaryParagraphs = [bodyParagraphs[0]];
    remainingBodyParagraphs = bodyParagraphs.slice(1);
  }

  let achievements: string[] = [];
  if (achievementKey && sections.get(achievementKey)) {
    const section = sections.get(achievementKey)!;
    achievements = section.bullets.length > 0 ? section.bullets : section.lines;
  } else if (bodySection && bodySection.bullets.length > 0) {
    achievements = bodySection.bullets;
  }

  const achievementsFromBody =
    !achievementKey && bodySection && bodySection.bullets.length > 0;

  const remainingSections: Array<{
    title?: string;
    paragraphs: string[];
    bullets: string[];
  }> = [];

  if (remainingBodyParagraphs.length > 0 || (!achievementsFromBody && bodySection?.bullets.length)) {
    const bodyBullets = !achievementsFromBody ? bodySection?.bullets ?? [] : [];
    if (remainingBodyParagraphs.length > 0 || bodyBullets.length > 0) {
      remainingSections.push({
        paragraphs: remainingBodyParagraphs,
        bullets: bodyBullets,
      });
    }
  }

  sections.forEach((section) => {
    if (section.key === "body") {
      return;
    }
    if (section.key === summaryKey || section.key === achievementKey) {
      return;
    }
    const paragraphs = splitParagraphs(section.lines);
    if (paragraphs.length === 0 && section.bullets.length === 0) {
      return;
    }
    remainingSections.push({
      title: section.title,
      paragraphs,
      bullets: section.bullets,
    });
  });

  return {
    summaryParagraphs,
    achievements,
    remainingSections,
  };
}

function isSectionMatch(title: string | undefined, keywords: string[]) {
  if (!title) {
    return false;
  }
  const normalized = normalizeHeading(title);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function stripMarkdown(text: string) {
  const lines = text.split(/\r?\n/);
  const cleanedLines = lines.map((line) => {
    let value = line.replace(/^#{1,6}\s+/, "");
    value = value.replace(/^\s*>+\s?/, "");
    value = value.replace(/^\s*[-*+]\s+/, "");
    value = value.replace(/^\s*\d+\.\s+/, "");
    value = value.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
    value = value.replace(/[`*_~]/g, "");
    return value.trimEnd();
  });

  return cleanedLines.join("\n").trim();
}

function parseCoverLetter(text: string) {
  const cleaned = stripMarkdown(text);
  const lines = cleaned.split(/\r?\n/);
  const dearIndex = lines.findIndex((line) =>
    line.trim().toLowerCase().startsWith("dear ")
  );

  let employerLines: string[] = [];
  let bodyLines = lines;

  if (dearIndex > 0) {
    const candidate = lines.slice(0, dearIndex).filter(Boolean);
    if (candidate.length >= 2) {
      employerLines = candidate;
      bodyLines = lines.slice(dearIndex);
    }
  }

  const bodyParagraphs = splitParagraphs(
    bodyLines.map((line) => line.trim())
  );
  let signOff = "";

  if (bodyParagraphs.length > 0) {
    const last = bodyParagraphs[bodyParagraphs.length - 1].trim().toLowerCase();
    if (SIGN_OFF_PREFIXES.some((prefix) => last.startsWith(prefix))) {
      signOff = bodyParagraphs.pop() ?? "";
    }
  }

  return { employerLines, bodyParagraphs, signOff };
}

type ParagraphStyleOptions = {
  spacing?: number;
  size?: number;
  bold?: boolean;
  heading?: HeadingValue;
  alignment?: "left" | "right" | "center";
};

function makeParagraph(text: string, options: ParagraphStyleOptions = {}) {
  const { Paragraph, TextRun, AlignmentType } = getDocxModule();
  const run = new TextRun({
    text,
    size: options.size,
    bold: options.bold,
  });
  const alignment =
    options.alignment === "right"
      ? AlignmentType.RIGHT
      : options.alignment === "center"
        ? AlignmentType.CENTER
        : AlignmentType.LEFT;
  return new Paragraph({
    children: [run],
    heading: options.heading,
    alignment,
    spacing: { after: options.spacing ?? 160 },
  });
}

function makeBulletParagraph(
  text: string,
  spacing: number,
  size: number
) {
  const { Paragraph, TextRun } = getDocxModule();
  return new Paragraph({
    children: [new TextRun({ text, size })],
    bullet: { level: 0 },
    spacing: { after: spacing },
  });
}

const FONT_SIZES = {
  body: 22,
  heading: 24,
  name: 28,
};

function getSpacing(variant: ExportVariant) {
  if (variant === "ats_minimal") {
    return {
      body: 120,
      bullet: 80,
      section: 140,
      header: 120,
      afterSection: 100,
    };
  }
  return {
    body: 160,
    bullet: 100,
    section: 160,
    header: 140,
    afterSection: 120,
  };
}

export async function packDoc(doc: DocxDocument) {
  const { Packer } = getDocxModule();
  return Packer.toBuffer(doc);
}

type DocxContactOptions = {
  email?: string | null;
  contactText?: string | null;
  headline?: string | null;
  variant?: ExportVariant;
  recipientName?: string | null;
  companyName?: string | null;
  companyLocation?: string | null;
  workHistory?: WorkHistoryRecord[];
};

type WorkHistoryEntry = {
  heading: string;
  meta?: string | null;
  summary?: string | null;
  bullets: string[];
};

type WorkHistorySection = {
  title: string;
  entries: WorkHistoryEntry[];
};

function trimWorkBullet(line: string, maxLength = 200) {
  const cleaned = line.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatWorkDate(value?: string | null) {
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

export function buildWorkHistorySection(
  workHistory: WorkHistoryRecord[] | undefined,
  variant: ExportVariant
): WorkHistorySection | null {
  if (!workHistory || workHistory.length === 0) {
    return null;
  }

  const sorted = [...workHistory].sort((a, b) => {
    if (a.is_current !== b.is_current) {
      return a.is_current ? -1 : 1;
    }
    const aDate = a.end_date ?? a.start_date;
    const bDate = b.end_date ?? b.start_date;
    return bDate.localeCompare(aDate);
  });

  const entries: WorkHistoryEntry[] = [];
  const headingSeparator = variant === "ats_minimal" ? " | " : " — ";

  sorted.forEach((entry) => {
    const jobTitle = sanitizeInlineText(entry.job_title ?? "").trim();
    const company = sanitizeInlineText(entry.company ?? "").trim();
    if (!jobTitle || !company) {
      return;
    }

    const heading = `${jobTitle}${headingSeparator}${company}`;
    const location = entry.location ? sanitizeInlineText(entry.location) : "";
    const startLabel = formatWorkDate(entry.start_date);
    const endLabel = entry.is_current
      ? "Present"
      : formatWorkDate(entry.end_date) || "Present";
    const dateLine = startLabel ? `${startLabel} – ${endLabel}` : "";
    const metaParts = [location, dateLine].filter(Boolean);
    const summary = entry.summary ? sanitizeInlineText(entry.summary) : "";
    const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];

    entries.push({
      heading,
      meta: metaParts.length ? metaParts.join(" • ") : null,
      summary: summary || null,
      bullets: bullets
        .map((bullet) => sanitizeInlineText(bullet))
        .filter(Boolean)
        .slice(0, 6)
        .map((bullet) => trimWorkBullet(bullet, 200)),
    });
  });

  if (entries.length === 0) {
    return null;
  }

  return {
    title: "Professional Experience",
    entries,
  };
}

export function buildCvDocx(
  profile: ProfileRecord | null,
  cvText: string,
  options?: DocxContactOptions
) {
  const parsed = parseCvText(cvText);
  const { Document } = getDocxModule();
  const { titleHeading, sectionHeading } = resolveHeadingLevels();
  const variant = options?.variant ?? "standard";
  const spacing = getSpacing(variant);
  const children: DocxParagraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = options?.headline?.trim() || profile?.headline?.trim() || "";
  const location = profile?.location?.trim();
  const phone = extractPhone(cvText);
  const linkedIn = extractLinkedIn(cvText);
  const contactLine = buildContactLine([
    headline || null,
    location,
    options?.email ?? null,
    phone,
    linkedIn,
  ]);

  if (name) {
    children.push(
      makeParagraph(name, {
        heading: titleHeading,
        size: FONT_SIZES.name,
        spacing: spacing.header,
        bold: true,
      })
    );
  }

  if (contactLine) {
    children.push(
      makeParagraph(contactLine, {
        size: FONT_SIZES.body,
        spacing: spacing.header,
      })
    );
  }

  if (parsed.summaryParagraphs.length > 0) {
    children.push(
      makeParagraph("Professional Summary", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    parsed.summaryParagraphs.forEach((paragraph) => {
      children.push(
        makeParagraph(paragraph, { size: FONT_SIZES.body, spacing: spacing.body })
      );
    });
  }

  const skillsSections = parsed.remainingSections.filter((section) =>
    isSectionMatch(section.title, ["skills", "key skills"])
  );
  if (skillsSections.length > 0) {
    children.push(
      makeParagraph("Key Skills", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    skillsSections.forEach((section) => {
      section.paragraphs.forEach((paragraph) => {
        children.push(
          makeParagraph(paragraph, {
            size: FONT_SIZES.body,
            spacing: spacing.body,
          })
        );
      });
      section.bullets.forEach((bullet) => {
        children.push(
          makeBulletParagraph(
            trimMetricLine(bullet, 120),
            spacing.bullet,
            FONT_SIZES.body
          )
        );
      });
    });
  }

  const workHistorySection = buildWorkHistorySection(
    options?.workHistory,
    variant
  );
  if (workHistorySection) {
    children.push(
      makeParagraph(workHistorySection.title, {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    workHistorySection.entries.forEach((entry) => {
      children.push(
        makeParagraph(entry.heading, {
          size: FONT_SIZES.body,
          spacing: spacing.body,
          bold: true,
        })
      );
      if (entry.meta) {
        children.push(
          makeParagraph(entry.meta, {
            size: FONT_SIZES.body,
            spacing: spacing.body,
          })
        );
      }
      if (entry.summary) {
        children.push(
          makeParagraph(entry.summary, {
            size: FONT_SIZES.body,
            spacing: spacing.body,
          })
        );
      }
      entry.bullets.forEach((bullet) => {
        children.push(
          makeBulletParagraph(
            bullet,
            spacing.bullet,
            FONT_SIZES.body
          )
        );
      });
    });
  }

  const experienceSections = parsed.remainingSections.filter((section) =>
    isSectionMatch(section.title, ["experience", "employment"])
  );
  const experienceParagraphs = experienceSections.flatMap(
    (section) => section.paragraphs
  );
  const experienceBullets = [
    ...parsed.achievements,
    ...experienceSections.flatMap((section) => section.bullets),
  ];

  if (experienceParagraphs.length > 0 || experienceBullets.length > 0) {
    children.push(
      makeParagraph("Experience / Achievements", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    experienceParagraphs.forEach((paragraph) => {
      children.push(
        makeParagraph(paragraph, { size: FONT_SIZES.body, spacing: spacing.body })
      );
    });
    experienceBullets.forEach((item) => {
      children.push(
        makeBulletParagraph(
          trimMetricLine(item, 120),
          spacing.bullet,
          FONT_SIZES.body
        )
      );
    });
  }

  const educationSections = parsed.remainingSections.filter((section) =>
    isSectionMatch(section.title, ["education"])
  );
  if (educationSections.length > 0) {
    children.push(
      makeParagraph("Education", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    educationSections.forEach((section) => {
      section.paragraphs.forEach((paragraph) => {
        children.push(
          makeParagraph(paragraph, {
            size: FONT_SIZES.body,
            spacing: spacing.body,
          })
        );
      });
      section.bullets.forEach((bullet) => {
        children.push(
          makeBulletParagraph(
            trimMetricLine(bullet, 120),
            spacing.bullet,
            FONT_SIZES.body
          )
        );
      });
    });
  }

  const otherSections = parsed.remainingSections.filter(
    (section) =>
      !skillsSections.includes(section) &&
      !experienceSections.includes(section) &&
      !educationSections.includes(section)
  );

  otherSections.forEach((section) => {
    if (section.title) {
      children.push(
        makeParagraph(section.title, {
          heading: sectionHeading,
          size: FONT_SIZES.heading,
          spacing: spacing.section,
          bold: true,
        })
      );
    }
    section.paragraphs.forEach((paragraph) => {
      children.push(
        makeParagraph(paragraph, { size: FONT_SIZES.body, spacing: spacing.body })
      );
    });
    section.bullets.forEach((bullet) => {
      children.push(
        makeBulletParagraph(
          trimMetricLine(bullet, 120),
          spacing.bullet,
          FONT_SIZES.body
        )
      );
    });
  });

  if (children.length === 0) {
    children.push(
      makeParagraph("CV content unavailable.", {
        size: FONT_SIZES.body,
        spacing: spacing.body,
      })
    );
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

type InterviewPackDocxOptions = {
  email?: string | null;
  headline?: string | null;
  contactText?: string | null;
  variant?: ExportVariant;
};

export function buildInterviewPackDocx(
  profile: ProfileRecord | null,
  pack: InterviewPack,
  options?: InterviewPackDocxOptions
) {
  const { Document } = getDocxModule();
  const { titleHeading, sectionHeading } = resolveHeadingLevels();
  const variant = options?.variant ?? "standard";
  const spacing = getSpacing(variant);
  const children: DocxParagraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = options?.headline?.trim() || profile?.headline?.trim() || "";
  const location = profile?.location?.trim();
  const contactSource = options?.contactText ?? "";
  const phone = contactSource ? extractPhone(contactSource) : null;
  const linkedIn = contactSource ? extractLinkedIn(contactSource) : null;
  const contactLine = buildContactLine([
    headline || null,
    location,
    options?.email ?? null,
    phone,
    linkedIn,
  ]);

  if (name) {
    children.push(
      makeParagraph(name, {
        heading: titleHeading,
        size: FONT_SIZES.name,
        spacing: spacing.header,
        bold: true,
      })
    );
  }

  if (contactLine) {
    children.push(
      makeParagraph(contactLine, {
        size: FONT_SIZES.body,
        spacing: spacing.header,
      })
    );
  }

  if (pack.roleSnapshot.length > 0) {
    children.push(
      makeParagraph("Role Snapshot", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    pack.roleSnapshot.forEach((item) => {
      const cleaned = normaliseLine(item);
      if (!cleaned) {
        return;
      }
      children.push(
        makeBulletParagraph(cleaned, spacing.bullet, FONT_SIZES.body)
      );
    });
  }

  if (pack.questions.length > 0) {
    children.push(
      makeParagraph("Top Questions", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    pack.questions.forEach((question) => {
      const cleanedQuestion = normaliseLine(question.question);
      if (!cleanedQuestion) {
        return;
      }
      children.push(
        makeParagraph(cleanedQuestion, {
          size: FONT_SIZES.body,
          spacing: spacing.body,
          bold: true,
        })
      );
      if (question.signals.length > 0) {
        children.push(
          makeParagraph(`Signals: ${question.signals.join(", ")}`, {
            size: FONT_SIZES.body,
            spacing: spacing.body,
          })
        );
      }
      splitPromptLines(question.starPrompt).forEach((line) => {
        children.push(
          makeBulletParagraph(line, spacing.bullet, FONT_SIZES.body)
        );
      });
    });
  }

  if (pack.weakSpots.length > 0) {
    children.push(
      makeParagraph("Weak Spots & Actions", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    pack.weakSpots.forEach((spot) => {
      const label = normaliseLine(spot.label);
      if (!label) {
        return;
      }
      children.push(
        makeParagraph(label, {
          size: FONT_SIZES.body,
          spacing: spacing.body,
          bold: true,
        })
      );
      const action = normaliseLine(spot.actionSuggestion);
      if (action) {
        children.push(
          makeBulletParagraph(
            `Action: ${action}`,
            spacing.bullet,
            FONT_SIZES.body
          )
        );
      }
      spot.metricSuggestions.forEach((metric) => {
        const cleanedMetric = trimMetricLine(normaliseLine(metric), 120);
        if (!cleanedMetric) {
          return;
        }
        children.push(
          makeBulletParagraph(
            `Metric: ${cleanedMetric}`,
            spacing.bullet,
            FONT_SIZES.body
          )
        );
      });
    });
  }

  if (pack.prepChecklist.length > 0) {
    children.push(
      makeParagraph("Prep Checklist", {
        heading: sectionHeading,
        size: FONT_SIZES.heading,
        spacing: spacing.section,
        bold: true,
      })
    );
    pack.prepChecklist.forEach((item) => {
      const cleaned = normaliseLine(item);
      if (!cleaned) {
        return;
      }
      children.push(
        makeBulletParagraph(cleaned, spacing.bullet, FONT_SIZES.body)
      );
    });
  }

  if (children.length === 0) {
    children.push(
      makeParagraph("Interview pack content unavailable.", {
        size: FONT_SIZES.body,
        spacing: spacing.body,
      })
    );
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

function splitPromptLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => normaliseLine(line))
    .filter(Boolean);
}

function normaliseLine(value: string) {
  return sanitizeInlineText(value).replace(/\s+/g, " ").trim();
}

export function buildCoverLetterDocx(
  profile: ProfileRecord | null,
  coverLetter: string,
  options?: DocxContactOptions
) {
  const parsed = parseCoverLetter(coverLetter);
  const { Document } = getDocxModule();
  const { titleHeading } = resolveHeadingLevels();
  const variant = options?.variant ?? "standard";
  const spacing = getSpacing(variant);
  const children: DocxParagraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = options?.headline?.trim() || profile?.headline?.trim() || "";
  const location = profile?.location?.trim();
  const contactSource = options?.contactText
    ? `${coverLetter}\n${options.contactText}`
    : coverLetter;
  const phone = extractPhone(contactSource);
  const linkedIn = extractLinkedIn(contactSource);
  const contactLine = buildContactLine([
    headline || null,
    location,
    options?.email ?? null,
    phone,
    linkedIn,
  ]);

  if (name) {
    children.push(
      makeParagraph(name, {
        heading: titleHeading,
        size: FONT_SIZES.name,
        spacing: spacing.header,
        bold: true,
      })
    );
  }

  if (contactLine) {
    children.push(
      makeParagraph(contactLine, {
        size: FONT_SIZES.body,
        spacing: spacing.header,
        alignment: "right",
      })
    );
  }

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  children.push(
    makeParagraph(dateLabel, {
      size: FONT_SIZES.body,
      spacing: spacing.section,
    })
  );

  const recipient = options?.recipientName?.trim() || "Hiring Manager";
  const employerFallback = [
    recipient,
    options?.companyName?.trim() || null,
    options?.companyLocation?.trim() || null,
  ].filter(Boolean) as string[];

  const employerLines =
    parsed.employerLines.length > 0 ? parsed.employerLines : employerFallback;

  if (employerLines.length > 0) {
    employerLines.forEach((line) => {
      children.push(
        makeParagraph(line, { size: FONT_SIZES.body, spacing: spacing.body })
      );
    });
    children.push(
      makeParagraph("", { size: FONT_SIZES.body, spacing: spacing.afterSection })
    );
  }

  const bodyParagraphs = [...parsed.bodyParagraphs];
  if (
    bodyParagraphs.length === 0 ||
    !bodyParagraphs[0].toLowerCase().startsWith("dear ")
  ) {
    bodyParagraphs.unshift(`Dear ${recipient},`);
  }

  bodyParagraphs.forEach((paragraph) => {
    children.push(
      makeParagraph(paragraph, { size: FONT_SIZES.body, spacing: spacing.body })
    );
  });

  if (parsed.signOff) {
    children.push(
      makeParagraph(parsed.signOff, { size: FONT_SIZES.body, spacing: spacing.body })
    );
  } else if (name) {
    children.push(
      makeParagraph("Kind regards,", {
        size: FONT_SIZES.body,
        spacing: spacing.body,
      })
    );
    children.push(
      makeParagraph(name, { size: FONT_SIZES.body, spacing: spacing.body })
    );
  }

  if (children.length === 0) {
    children.push(
      makeParagraph("Cover letter content unavailable.", {
        size: FONT_SIZES.body,
        spacing: spacing.body,
      })
    );
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}
