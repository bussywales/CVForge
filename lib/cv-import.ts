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

export type CvImportWorkHistory = {
  job_title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  summary?: string;
  bullets: string[];
};

export type CvImportPreview = {
  profile: CvImportProfile;
  achievements: CvImportAchievement[];
  work_history: CvImportWorkHistory[];
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
    "work history",
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
  const { sectionLookup, sectionsDetected } = buildSectionLookup(lines);
  const extraction = extractAchievementsAndSkills(
    lines,
    sectionLookup,
    sectionsDetected
  );
  const workHistory = extractWorkHistory(lines, sectionLookup);

  return {
    profile,
    achievements: extraction.achievements,
    work_history: workHistory.entries,
    extracted: {
      skills: extraction.skills.length ? extraction.skills : undefined,
      sectionsDetected,
      warnings: [...extraction.warnings, ...workHistory.warnings],
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

function buildSectionLookup(lines: string[]) {
  const sectionsDetected: string[] = [];
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

  return { sectionLookup, sectionsDetected };
}

function extractAchievementsAndSkills(
  lines: string[],
  sectionLookup: Map<number, SectionKey>,
  sectionsDetected: string[]
) {
  const achievements: CvImportAchievement[] = [];
  const warnings: string[] = [];
  const skills: string[] = [];

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

type WorkHistoryExtraction = {
  entries: CvImportWorkHistory[];
  warnings: string[];
};

function extractWorkHistory(
  lines: string[],
  sectionLookup: Map<number, SectionKey>
): WorkHistoryExtraction {
  const entries: CvImportWorkHistory[] = [];
  const warnings: string[] = [];

  let currentSection: SectionKey | null = null;
  let currentRole: CvImportWorkHistory | null = null;

  const flushRole = () => {
    if (!currentRole) {
      return;
    }
    const hasTitle = currentRole.job_title.trim().length >= 2;
    const hasCompany = currentRole.company.trim().length >= 2;
    if (hasTitle && hasCompany) {
      currentRole.bullets = currentRole.bullets.slice(0, 6);
      entries.push(currentRole);
    }
    currentRole = null;
  };

  const hasExperienceSection = Array.from(sectionLookup.values()).some(
    (key) => key === "experience"
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionKey = sectionLookup.get(index);

    if (sectionKey) {
      if (currentSection === "experience" && sectionKey !== "experience") {
        flushRole();
      }
      currentSection = sectionKey;
      continue;
    }

    if (currentSection !== "experience") {
      continue;
    }

    const dateRange = parseDateRange(line);
    if (dateRange) {
      flushRole();
      const headerLine =
        dateRange.headerLine ||
        findHeaderCandidate(lines[index - 1]) ||
        "";
      const header = parseRoleHeader(headerLine);
      if (!header) {
        continue;
      }
      currentRole = {
        job_title: header.job_title,
        company: header.company,
        location: header.location,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date ?? undefined,
        is_current: dateRange.is_current,
        bullets: [],
      };
      continue;
    }

    if (!currentRole) {
      continue;
    }

    const bullet = stripBullet(line);
    if (bullet) {
      if (currentRole.bullets.length < 6) {
        currentRole.bullets.push(clampText(bullet.trim()));
      }
      continue;
    }

    if (!currentRole.location && looksLikeLocation(line)) {
      currentRole.location = clampShort(line, 80);
      continue;
    }

    if (!currentRole.summary && looksLikeSummary(line)) {
      currentRole.summary = clampShort(line, 300);
      continue;
    }
  }

  flushRole();

  if (hasExperienceSection && entries.length === 0) {
    warnings.push(
      "Experience section detected but no roles were parsed. You may need to add them manually."
    );
  }

  return { entries, warnings };
}

type DateRangeMatch = {
  start_date: string;
  end_date?: string;
  is_current: boolean;
  headerLine?: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseDateRange(line: string): DateRangeMatch | null {
  const rangeRegex =
    /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{4})\s+\d{4}|\d{4})\s*(?:–|—|-)\s*(present|current|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{4})\s+\d{4}|\d{4})/i;

  const match = line.match(rangeRegex);
  if (!match) {
    return null;
  }

  const startToken = match[1];
  const endToken = match[2];
  const start = parseMonthYear(startToken);
  if (!start) {
    return null;
  }

  const isCurrent = /present|current/i.test(endToken);
  const end = isCurrent ? null : parseMonthYear(endToken);
  if (!isCurrent && !end) {
    return null;
  }

  const headerLine = line.replace(match[0], "").replace(/[–—-]+/g, " ").trim();

  return {
    start_date: formatMonthYear(start.year, start.month),
    end_date: end ? formatMonthYear(end.year, end.month) : undefined,
    is_current: isCurrent,
    headerLine: headerLine || undefined,
  };
}

function parseMonthYear(token: string) {
  const cleaned = token.replace(/[(),]/g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    const year = Number(parts[0]);
    if (!Number.isFinite(year) || year < 1900) {
      return null;
    }
    return { year, month: 1 };
  }
  if (parts.length >= 2) {
    const monthKey = parts[0].toLowerCase();
    const month = MONTHS[monthKey];
    const year = Number(parts[1]);
    if (!month || !Number.isFinite(year)) {
      return null;
    }
    return { year, month };
  }
  return null;
}

function formatMonthYear(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}

function findHeaderCandidate(line?: string) {
  if (!line) {
    return "";
  }
  if (isSectionHeading(line) || stripBullet(line)) {
    return "";
  }
  return line;
}

function parseRoleHeader(line: string) {
  const cleaned = line.trim();
  if (!cleaned) {
    return null;
  }

  const atMatch = cleaned.match(/^(.*?)\s+at\s+(.*)$/i);
  if (atMatch) {
    return {
      job_title: clampShort(atMatch[1], 120),
      company: clampShort(atMatch[2], 120),
    };
  }

  const separators = [" | ", " — ", " – ", " - ", ","];
  for (const separator of separators) {
    if (!cleaned.includes(separator)) {
      continue;
    }
    const parts = cleaned.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      continue;
    }
    let jobTitle = parts[0];
    let company = parts[1];
    let location = parts[2];
    if (separator === " | " || separator === " - " || separator === " — " || separator === " – ") {
      if (looksLikeCompany(parts[0]) && parts[1]) {
        company = parts[0];
        jobTitle = parts[1];
        location = parts[2];
      }
    }
    return {
      job_title: clampShort(jobTitle, 120),
      company: clampShort(company, 120),
      location: location ? clampShort(location, 80) : undefined,
    };
  }

  return null;
}

function looksLikeCompany(value: string) {
  const lowered = value.toLowerCase();
  return /ltd|limited|inc|corp|plc|llp|llc|company|group|university|college|trust|council|nhs|bank|agency/.test(
    lowered
  );
}

function looksLikeLocation(value: string) {
  if (value.length > 80) {
    return false;
  }
  if (isContactLine(value) || isSectionHeading(value)) {
    return false;
  }
  return value.includes(",");
}

function looksLikeSummary(value: string) {
  if (value.length < 10 || value.length > 160) {
    return false;
  }
  if (isContactLine(value) || isSectionHeading(value)) {
    return false;
  }
  return true;
}

function clampShort(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return trimmed.slice(0, max).trim();
}
