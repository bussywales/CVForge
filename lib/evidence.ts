import type { AchievementRecord } from "@/lib/data/achievements";
import type { WorkHistoryRecord } from "@/lib/data/work-history";
import type { RoleFitSignal } from "@/lib/role-fit";
import { matchesRoleFitAliases, normalizeRoleFitText } from "@/lib/role-fit";

export type EvidenceItem = {
  id: string;
  kind: "achievement" | "work_bullet";
  title: string;
  text: string;
  dateRange?: string;
  signals: string[];
  weight: number;
};

export type EvidenceSnippet = {
  snippet: string;
  shortSnippet: string;
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
  achievements: AchievementRecord[];
  workHistory: WorkHistoryRecord[];
  signals: RoleFitSignal[];
};

export function buildEvidenceBank({
  profileHeadline,
  achievements,
  workHistory,
  signals,
}: EvidenceBankInput): EvidenceBank {
  const items: EvidenceItem[] = [];

  achievements.forEach((achievement) => {
    const text =
      achievement.metrics?.trim() ||
      achievement.action?.trim() ||
      achievement.result?.trim() ||
      "";
    if (!text) {
      return;
    }
    const match = matchSignals(
      `${achievement.title} ${text} ${profileHeadline ?? ""}`,
      signals
    );
    items.push({
      id: `ach:${achievement.id}`,
      kind: "achievement",
      title: achievement.title,
      text,
      signals: match.signalIds,
      weight: match.score,
    });
  });

  workHistory.forEach((entry) => {
    const dateRange = formatDateRange(entry);
    const recencyBoost = getRecencyBoost(entry);
    const roleLabel = `${entry.job_title} @ ${entry.company}`;
    entry.bullets.forEach((bullet, index) => {
      const text = bullet.trim();
      if (!text) {
        return;
      }
      const match = matchSignals(
        `${roleLabel} ${text} ${profileHeadline ?? ""}`,
        signals
      );
      items.push({
        id: `wh:${entry.id}:b${index}`,
        kind: "work_bullet",
        title: roleLabel,
        text,
        dateRange,
        signals: match.signalIds,
        weight: match.score + recencyBoost,
      });
    });
  });

  const byId = new Map<string, EvidenceItem>();
  items.forEach((item) => byId.set(item.id, item));

  return { items, byId };
}

export function matchSignals(text: string, signals: RoleFitSignal[]) {
  const corpus = normalizeRoleFitText(text);
  const matched = signals.filter((signal) =>
    matchesRoleFitAliases(corpus, signal.aliases)
  );
  const signalIds = matched.map((signal) => signal.id);
  const score = matched.reduce((total, signal) => total + signal.weight, 0);
  return { signalIds, score };
}

export function rankEvidenceForGap(
  gapSignalId: string,
  evidence: EvidenceBank,
  limit = 3
) {
  return evidence.items
    .filter((item) => item.signals.includes(gapSignalId))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return b.text.length - a.text.length;
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
