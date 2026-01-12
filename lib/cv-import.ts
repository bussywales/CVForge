export type CvImportProfile = {
  full_name?: string;
  headline?: string;
};

export type CvImportAchievement = {
  title: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  metrics?: string;
};

export type CvImportPreview = {
  profile: CvImportProfile;
  achievements: CvImportAchievement[];
  extracted: {
    skills?: string[];
    sectionsDetected: string[];
    warnings: string[];
  };
};

type SectionKey = "experience" | "projects" | "achievements" | "skills" | "education";

const SECTION_ALIASES: Record<SectionKey, string[]> = {
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "career history",
  ],
  projects: ["projects", "project experience", "project work"],
  achievements: ["achievements", "key achievements", "accomplishments"],
  skills: ["skills", "technical skills", "key skills", "core skills"],
  education: ["education", "qualifications", "certifications"],
};

const RELEVANT_SECTIONS = new Set<SectionKey>([
  "experience",
  "projects",
  "achievements",
]);

const CONTACT_REGEX = /(@|https?:\/\/|linkedin|github)/i;
const PHONE_REGEX = /(\+?\d[\d\s\-()]{7,})/;

const FLUFF_HEADERS = new Set(["curriculum vitae", "cv", "resume"]);

const METRIC_UNITS = new Set([
  "hours",
  "hour",
  "hrs",
  "days",
  "day",
  "weeks",
  "week",
  "months",
  "month",
  "years",
  "year",
  "mins",
  "minutes",
  "minute",
  "seconds",
  "second",
  "tickets",
  "incidents",
  "requests",
  "users",
  "clients",
  "customers",
  "sla",
  "mttr",
  "mttd",
  "uptime",
  "availability",
  "cost",
  "savings",
  "reduction",
  "increase",
  "improvement",
  "budget",
  "revenue",
  "issues",
]);

const NUMERIC_TOKEN = /^(?:£|\$|€)?\d+(?:[.,]\d+)?%?(?:k|m|bn|million|billion)?$/i;

export function extractCvPreview(text: string): CvImportPreview {
  const lines = toLines(text);
  const { profile } = extractProfile(lines);
  const extraction = extractAchievementsAndSkills(lines);

  return {
    profile,
    achievements: extraction.achievements,
    extracted: {
      skills: extraction.skills.length ? extraction.skills : undefined,
      sectionsDetected: extraction.sectionsDetected,
      warnings: extraction.warnings,
    },
  };
}

function toLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractProfile(lines: string[]) {
  let nameIndex = -1;
  let fullName: string | undefined;
  let headline: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (isSectionHeading(line) || isContactLine(line) || isFluffHeader(line)) {
      continue;
    }
    if (looksLikeName(line)) {
      fullName = line;
      nameIndex = index;
      break;
    }
  }

  if (nameIndex >= 0) {
    for (let index = nameIndex + 1; index <= nameIndex + 3; index += 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      if (isSectionHeading(line) || isContactLine(line) || isFluffHeader(line)) {
        continue;
      }
      if (looksLikeHeadline(line)) {
        headline = line;
        break;
      }
    }
  }

  return {
    profile: {
      full_name: fullName,
      headline,
    },
  };
}

function extractAchievementsAndSkills(lines: string[]) {
  const achievements: CvImportAchievement[] = [];
  const sectionsDetected: string[] = [];
  const warnings: string[] = [];
  const skills: string[] = [];

  const sectionLookup = new Map<number, SectionKey>();

  lines.forEach((line, index) => {
    const key = getSectionKey(line);
    if (key) {
      sectionLookup.set(index, key);
      const label = toSectionLabel(key);
      if (!sectionsDetected.includes(label)) {
        sectionsDetected.push(label);
      }
    }
  });

  const hasRelevantSection = Array.from(sectionLookup.values()).some((key) =>
    RELEVANT_SECTIONS.has(key)
  );

  let currentSection: SectionKey | null = null;
  let currentContext = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionKey = sectionLookup.get(index);

    if (sectionKey) {
      currentSection = sectionKey;
      if (currentSection === "skills") {
        currentContext = "";
      }
      continue;
    }

    if (currentSection === "skills") {
      appendSkills(skills, line);
      continue;
    }

    const bullet = stripBullet(line);
    if (bullet) {
      if (!hasRelevantSection || (currentSection && RELEVANT_SECTIONS.has(currentSection))) {
        const action = bullet.trim();
        if (action.length >= 15) {
          const title = currentContext
            ? clampTitle(currentContext)
            : clampTitle(action);
          if (title.length >= 3) {
            const metrics = extractMetricsFromAction(action);
            achievements.push({
              title,
              action,
              metrics: metrics || undefined,
            });
          }
        }
      }
      continue;
    }

    if (!hasRelevantSection || (currentSection && RELEVANT_SECTIONS.has(currentSection))) {
      if (looksLikeContextLine(line)) {
        currentContext = line;
      }
    }
  }

  if (!hasRelevantSection) {
    warnings.push(
      "No Experience/Projects/Achievements section detected; imported bullets may be incomplete."
    );
  }

  if (achievements.length === 0) {
    warnings.push("No bullet points detected; imported achievements may be limited.");
  }

  return {
    achievements,
    sectionsDetected,
    warnings,
    skills,
  };
}

function stripBullet(line: string) {
  const match = line.match(/^(\u2022|•|\-|\*|–|—|\d+\.)\s+(.*)$/);
  if (match) {
    return match[2];
  }
  return null;
}

function appendSkills(skills: string[], line: string) {
  const raw = line.replace(/[•\u2022]/g, ",");
  const parts = raw.split(/[;,]/).map((part) => part.trim());
  parts.forEach((part) => {
    if (part && part.length >= 2 && !skills.includes(part)) {
      skills.push(part);
    }
  });
}

function getSectionKey(line: string): SectionKey | null {
  const normalized = normalizeHeading(line);
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((alias) => normalizeHeading(alias) === normalized)) {
      return key as SectionKey;
    }
  }
  return null;
}

function normalizeHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toSectionLabel(key: SectionKey) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function isSectionHeading(line: string) {
  return Boolean(getSectionKey(line));
}

function isFluffHeader(line: string) {
  return FLUFF_HEADERS.has(normalizeHeading(line));
}

function isContactLine(line: string) {
  if (CONTACT_REGEX.test(line)) {
    return true;
  }
  if (PHONE_REGEX.test(line)) {
    return true;
  }
  return false;
}

function looksLikeName(line: string) {
  if (line.length < 3 || line.length > 60) {
    return false;
  }
  if (line.split(" ").length < 2) {
    return false;
  }
  if (/\d/.test(line)) {
    return false;
  }
  return /^[a-zA-Z][a-zA-Z'\-.\s]+$/.test(line);
}

function looksLikeHeadline(line: string) {
  if (line.length < 3 || line.length > 90) {
    return false;
  }
  if (/\d{4}/.test(line)) {
    return false;
  }
  return true;
}

function looksLikeContextLine(line: string) {
  if (line.length < 3 || line.length > 120) {
    return false;
  }
  if (isContactLine(line) || isSectionHeading(line)) {
    return false;
  }
  return true;
}

export function extractMetricsFromAction(action: string) {
  const tokens = action
    .split(/\s+/)
    .map((token) => token.replace(/[()[\],]/g, ""));

  const metrics: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (NUMERIC_TOKEN.test(token)) {
      const phrase = [token];
      for (let offset = 1; offset <= 3; offset += 1) {
        const next = tokens[index + offset];
        if (!next) {
          break;
        }
        const cleaned = next.replace(/[.,;:]+$/g, "").toLowerCase();
        if (METRIC_UNITS.has(cleaned) || /%$/.test(cleaned)) {
          phrase.push(next);
        } else {
          break;
        }
      }
      metrics.push(phrase.join(" "));
    }

    if (METRIC_UNITS.has(token.toLowerCase())) {
      const next = tokens[index + 1];
      if (next && NUMERIC_TOKEN.test(next)) {
        metrics.push(`${token.toUpperCase()} ${next}`);
      }
    }
  }

  const unique = Array.from(new Set(metrics.map((metric) => metric.trim()))).filter(
    Boolean
  );

  if (!unique.length) {
    return "";
  }

  return clampText(unique.join("; "));
}

function clampTitle(value: string) {
  const trimmed = value.trim().replace(/[.,;:]+$/g, "");
  if (trimmed.length <= 80) {
    return trimmed;
  }
  return trimmed.slice(0, 80).trim();
}

function clampText(value: string) {
  if (value.length <= 120) {
    return value;
  }
  return value.slice(0, 120).replace(/[.;:,]+$/g, "").trim();
}
