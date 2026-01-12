import type { Document } from "docx";
import * as docx from "docx";
import type { ProfileRecord } from "@/lib/data/profile";

type ParsedSection = {
  key: string;
  title?: string;
  lines: string[];
  bullets: string[];
};

type ParsedCv = {
  summaryParagraphs: string[];
  achievements: string[];
  remainingSections: Array<{ title?: string; paragraphs: string[] }>;
};

type HeadingValue =
  | "Heading1"
  | "Heading2"
  | "Title"
  | "Heading3"
  | "Heading4"
  | "Heading5"
  | "Heading6";

const Heading = (docx as unknown as { HeadingLevel?: Record<string, string> })
  .HeadingLevel;
const titleHeading = (Heading?.TITLE ?? Heading?.HEADING_1 ?? "Heading1") as HeadingValue;
const sectionHeading = (Heading?.HEADING_2 ?? Heading?.HEADING_1 ?? "Heading2") as HeadingValue;

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

  const remainingSections: Array<{ title?: string; paragraphs: string[] }> = [];

  if (remainingBodyParagraphs.length > 0 || (!achievementsFromBody && bodySection?.bullets.length)) {
    const bodyExtras = [
      ...remainingBodyParagraphs,
      ...(!achievementsFromBody ? bodySection?.bullets ?? [] : []),
    ];
    if (bodyExtras.length > 0) {
      remainingSections.push({ paragraphs: bodyExtras });
    }
  }

  sections.forEach((section) => {
    if (section.key === "body") {
      return;
    }
    if (section.key === summaryKey || section.key === achievementKey) {
      return;
    }
    const paragraphs = [
      ...splitParagraphs(section.lines),
      ...section.bullets,
    ].filter(Boolean);
    if (paragraphs.length === 0) {
      return;
    }
    remainingSections.push({ title: section.title, paragraphs });
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

function makeParagraph(text: string, spacing = 160) {
  return new docx.Paragraph({
    text,
    spacing: { after: spacing },
  });
}

export async function packDoc(doc: Document) {
  return docx.Packer.toBuffer(doc);
}

export function buildCvDocx(
  profile: ProfileRecord | null,
  cvText: string
) {
  const parsed = parseCvText(cvText);
  const children: docx.Paragraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = profile?.headline?.trim();
  const location = profile?.location?.trim();

  if (name) {
    children.push(
      new docx.Paragraph({
        text: name,
        heading: titleHeading,
        spacing: { after: 200 },
      })
    );
  }

  if (headline) {
    children.push(makeParagraph(headline, 120));
  }

  if (location) {
    children.push(makeParagraph(location, 240));
  }

  if (parsed.summaryParagraphs.length > 0) {
    children.push(
      new docx.Paragraph({
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
      new docx.Paragraph({
        text: "Key achievements",
        heading: sectionHeading,
      })
    );
    parsed.achievements.forEach((item) => {
      children.push(
        new docx.Paragraph({
          text: item,
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
    });
    children.push(makeParagraph("", 120));
  }

  parsed.remainingSections.forEach((section) => {
    if (section.title) {
      children.push(
        new docx.Paragraph({
          text: section.title,
          heading: sectionHeading,
        })
      );
    }
    section.paragraphs.forEach((paragraph) => {
      children.push(makeParagraph(paragraph));
    });
  });

  if (children.length === 0) {
    children.push(makeParagraph("CV content unavailable."));
  }

  return new docx.Document({
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
  email?: string | null
) {
  const { employerLines, bodyParagraphs, signOff } =
    parseCoverLetter(coverLetter);
  const children: docx.Paragraph[] = [];

  const name = profile?.full_name?.trim();
  const headline = profile?.headline?.trim();
  const location = profile?.location?.trim();

  if (name) {
    children.push(
      new docx.Paragraph({
        text: name,
        heading: titleHeading,
        spacing: { after: 120 },
      })
    );
  }

  if (headline) {
    children.push(makeParagraph(headline, 80));
  }

  if (location) {
    children.push(makeParagraph(location, 80));
  }

  if (email) {
    children.push(makeParagraph(email, 200));
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

  return new docx.Document({
    sections: [
      {
        children,
      },
    ],
  });
}
