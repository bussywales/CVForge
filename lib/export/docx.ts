import type {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
} from "docx";
import { createRequire } from "module";
import type { ProfileRecord } from "@/lib/data/profile";
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

const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/g;
const PHONE_LABEL_REGEX = /\b(phone|mobile|tel|telephone|cell)\b/i;
const LINKEDIN_REGEX =
  /(https?:\/\/)?(www\.)?linkedin\.com\/[^\s)]+/i;

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

    const bulletMatch = rawLine.match(/^\s*(?:[-*\u2022]|\d+\.)\s+(.*)$/);
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

function isLikelyPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16;
}

function extractPhone(text: string) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!PHONE_LABEL_REGEX.test(line)) {
      continue;
    }
    const matches = line.match(PHONE_REGEX);
    if (!matches) {
      continue;
    }
    const candidate = matches.find(isLikelyPhoneNumber);
    if (candidate) {
      return candidate.replace(/\s+/g, " ").trim();
    }
  }

  const matches = text.match(PHONE_REGEX) ?? [];
  const candidate = matches.find(isLikelyPhoneNumber);
  return candidate ? candidate.replace(/\s+/g, " ").trim() : null;
}

function extractLinkedIn(text: string) {
  const match = text.match(LINKEDIN_REGEX);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;]+$/, "").trim();
}

function buildContactLine(parts: Array<string | null | undefined>) {
  const cleaned = parts
    .map((part) => (part ? sanitizeInlineText(part) : ""))
    .map((part) => part.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned.join(" | ");
}

function makeParagraph(text: string, spacing = 160) {
  const { Paragraph } = getDocxModule();
  return new Paragraph({
    text,
    spacing: { after: spacing },
  });
}

export async function packDoc(doc: DocxDocument) {
  const { Packer } = getDocxModule();
  return Packer.toBuffer(doc);
}

type DocxContactOptions = {
  email?: string | null;
  contactText?: string | null;
};

export function buildCvDocx(
  profile: ProfileRecord | null,
  cvText: string,
  options?: DocxContactOptions
) {
  const parsed = parseCvText(cvText);
  const { Document, Paragraph } = getDocxModule();
  const { titleHeading, sectionHeading } = resolveHeadingLevels();
  const children: DocxParagraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = profile?.headline?.trim();
  const location = profile?.location?.trim();
  const phone = extractPhone(cvText);
  const linkedIn = extractLinkedIn(cvText);
  const contactLine = buildContactLine([
    location,
    options?.email ?? null,
    phone,
    linkedIn,
  ]);

  if (name) {
    children.push(
      new Paragraph({
        text: name,
        heading: titleHeading,
        spacing: { after: 120 },
      })
    );
  }

  if (headline) {
    children.push(makeParagraph(headline, 100));
  }

  if (contactLine) {
    children.push(makeParagraph(contactLine, 200));
  }

  if (parsed.summaryParagraphs.length > 0) {
    children.push(
      new Paragraph({
        text: "Profile summary",
        heading: sectionHeading,
      })
    );
    parsed.summaryParagraphs.forEach((paragraph) => {
      children.push(makeParagraph(paragraph));
    });
  }

  if (parsed.achievements.length > 0) {
    children.push(
      new Paragraph({
        text: "Key achievements",
        heading: sectionHeading,
      })
    );
    parsed.achievements.forEach((item) => {
      children.push(
        new Paragraph({
          text: item,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    });
    children.push(makeParagraph("", 80));
  }

  parsed.remainingSections.forEach((section) => {
    if (section.title) {
      children.push(
        new Paragraph({
          text: section.title,
          heading: sectionHeading,
        })
      );
    }
    section.paragraphs.forEach((paragraph) => {
      children.push(makeParagraph(paragraph));
    });
    section.bullets.forEach((bullet) => {
      children.push(
        new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    });
  });

  if (children.length === 0) {
    children.push(makeParagraph("CV content unavailable."));
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

export function buildCoverLetterDocx(
  profile: ProfileRecord | null,
  coverLetter: string,
  options?: DocxContactOptions
) {
  const { employerLines, bodyParagraphs, signOff } =
    parseCoverLetter(coverLetter);
  const { Document, Paragraph } = getDocxModule();
  const { titleHeading } = resolveHeadingLevels();
  const children: DocxParagraph[] = [];

  const name = profile?.full_name?.trim();
  const location = profile?.location?.trim();
  const contactSource = options?.contactText
    ? `${coverLetter}\n${options.contactText}`
    : coverLetter;
  const phone = extractPhone(contactSource);
  const linkedIn = extractLinkedIn(contactSource);
  const contactLine = buildContactLine([
    location,
    options?.email ?? null,
    phone,
    linkedIn,
  ]);

  if (name) {
    children.push(
      new Paragraph({
        text: name,
        heading: titleHeading,
        spacing: { after: 120 },
      })
    );
  }

  if (contactLine) {
    children.push(makeParagraph(contactLine, 160));
  }

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  children.push(makeParagraph(dateLabel, 200));

  if (employerLines.length > 0) {
    employerLines.forEach((line) => {
      children.push(makeParagraph(line, 80));
    });
    children.push(makeParagraph("", 200));
  }

  bodyParagraphs.forEach((paragraph) => {
    children.push(makeParagraph(paragraph));
  });

  if (signOff) {
    children.push(makeParagraph(signOff));
  } else if (name) {
    children.push(makeParagraph("Kind regards,", 80));
    children.push(makeParagraph(name));
  }

  if (children.length === 0) {
    children.push(makeParagraph("Cover letter content unavailable."));
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}
