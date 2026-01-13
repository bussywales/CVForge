import { detectPlaceholders } from "@/lib/submission-quality";
import { hasPlaceholderTokens } from "@/lib/utils/autopack-sanitize";
import {
  computePracticeStats,
  type PracticeStats,
  type PracticeAnswerSnapshot,
  type PracticeQuestion,
} from "@/lib/practice-dashboard";
import { slugifyName, truncateFilename } from "@/lib/export/filename";

export type KitChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
};

export type KitNextAction = {
  id: string;
  label: string;
  href: string;
};

export type KitChecklistResult = {
  items: KitChecklistItem[];
  score: number;
  nextActions: KitNextAction[];
  stats: PracticeStats;
  starDraftCount: number;
};

export type KitPracticeAnswer = PracticeAnswerSnapshot & {
  question_key: string;
  question_text?: string | null;
  rubric_json?: { recommendations?: string[] } | null;
};

export type KitChecklistInput = {
  applicationId: string;
  profileHeadline?: string | null;
  profileName?: string | null;
  userEmail?: string | null;
  achievements: Array<{ metrics: string | null }>;
  autopack: { id: string; cv_text: string | null; cover_letter: string | null } | null;
  practiceQuestions: PracticeQuestion[];
  practiceAnswers: Record<string, PracticeAnswerSnapshot>;
  starDrafts: unknown;
  outreachStage: string | null;
  activities: Array<{ type: string }>;
};

const KIT_CONTENTS = [
  "01_CV_ATS-Minimal.docx",
  "02_Cover-Letter_ATS-Minimal.docx",
  "03_Interview-Pack_Standard.docx",
  "04_STAR-Drafts.json",
];

export function getKitContentsList() {
  return [...KIT_CONTENTS];
}

export function buildApplicationKitFilename(name: string, role: string | null) {
  const safeName = slugifyName(name) || "CVForge";
  const safeRole = role ? slugifyName(role) : "";
  const base = [safeName, safeRole, "Application-Kit"].filter(Boolean).join("-");
  const trimmed = truncateFilename(base, "zip");
  return `${trimmed}.zip`;
}

export function computeKitChecklist(input: KitChecklistInput): KitChecklistResult {
  const profileOk = Boolean(input.profileHeadline?.trim());
  const profileHint = profileOk
    ? input.profileName || input.userEmail
      ? "Headline set; contact line optional."
      : "Add name or email to strengthen exports (optional)."
    : "Add a headline to your profile.";

  const metricsCount = input.achievements.filter((achievement) => {
    const metrics = achievement.metrics?.trim();
    if (!metrics) {
      return false;
    }
    return !hasPlaceholderTokens(metrics);
  }).length;

  const metricsOk = metricsCount >= 3;

  const autopackExists = Boolean(input.autopack?.id);

  const exportReady =
    Boolean(input.autopack?.cv_text?.trim()) &&
    Boolean(input.autopack?.cover_letter?.trim()) &&
    !detectPlaceholders(input.autopack?.cv_text ?? "") &&
    !detectPlaceholders(input.autopack?.cover_letter ?? "");

  const stats = computePracticeStats(
    input.practiceQuestions,
    input.practiceAnswers
  );

  const practiceOk =
    stats.total > 0 &&
    (stats.drafted / stats.total >= 0.5 || stats.scored / stats.total >= 0.3);

  const practiceAnswerCount = Object.values(input.practiceAnswers).filter(
    (answer) => Boolean(answer.answer_text && answer.answer_text.trim())
  ).length;

  const starDraftCount =
    practiceAnswerCount > 0
      ? practiceAnswerCount
      : Array.isArray(input.starDrafts)
        ? input.starDrafts.length
        : 0;

  const starOk = starDraftCount >= 3;

  const outreachOk =
    Boolean(input.outreachStage && input.outreachStage !== "not_started") ||
    input.activities.some((activity) => activity.type === "outreach");

  const items: KitChecklistItem[] = [
    {
      id: "profile",
      label: "Profile ready",
      ok: profileOk,
      hint: profileHint,
    },
    {
      id: "metrics",
      label: "3 achievements with metrics",
      ok: metricsOk,
      hint: metricsOk
        ? `${metricsCount} achievements include metrics.`
        : `Only ${metricsCount} achievements include metrics.`,
    },
    {
      id: "autopack",
      label: "Autopack generated",
      ok: autopackExists,
      hint: autopackExists
        ? "Latest version is available."
        : "Generate an autopack for this application.",
    },
    {
      id: "export",
      label: "Autopack export-ready",
      ok: exportReady,
      hint: exportReady
        ? "No placeholders detected."
        : "Fix placeholders and add role/company specifics.",
    },
    {
      id: "practice",
      label: "Practice progress",
      ok: practiceOk,
      hint: stats.total
        ? `${stats.drafted}/${stats.total} drafted, ${stats.scored}/${stats.total} scored.`
        : "No practice questions available yet.",
    },
    {
      id: "star",
      label: "STAR drafts",
      ok: starOk,
      hint: `${starDraftCount} STAR drafts available.`,
    },
    {
      id: "outreach",
      label: "Outreach step 1",
      ok: outreachOk,
      hint: outreachOk
        ? "Outreach has been started."
        : "Draft step 1 and schedule a follow-up.",
    },
  ];

  const weights = {
    profile: 10,
    metrics: 20,
    autopack: 15,
    export: 15,
    practice: 20,
    star: 10,
    outreach: 10,
  } as const;

  const score = items.reduce((sum, item) => {
    const weight = weights[item.id as keyof typeof weights] ?? 0;
    return sum + (item.ok ? weight : 0);
  }, 0);

  const nextActions: KitNextAction[] = [];

  if (!autopackExists) {
    nextActions.push({
      id: "autopack",
      label: "Generate Autopack",
      href: `/app/applications/${input.applicationId}#autopacks`,
    });
  }

  if (autopackExists && !exportReady && input.autopack?.id) {
    nextActions.push({
      id: "export",
      label: "Fix placeholders / add company specifics",
      href: `/app/applications/${input.applicationId}/autopacks/${input.autopack.id}`,
    });
  }

  if (!metricsOk) {
    nextActions.push({
      id: "metrics",
      label: "Add 1 metric to an achievement",
      href: "/app/profile#achievements",
    });
  }

  if (!practiceOk) {
    nextActions.push({
      id: "practice",
      label: "Score your 2 lowest questions in Drill Mode",
      href: `/app/applications/${input.applicationId}/practice/drill`,
    });
  }

  if (!starOk) {
    nextActions.push({
      id: "star",
      label: "Create 1 STAR draft from a scored question",
      href: `/app/applications/${input.applicationId}/practice`,
    });
  }

  if (!outreachOk) {
    nextActions.push({
      id: "outreach",
      label: "Draft outreach Step 1 and schedule follow-up",
      href: "/app/pipeline",
    });
  }

  return {
    items,
    score: Math.min(score, 100),
    nextActions: nextActions.slice(0, 3),
    stats,
    starDraftCount,
  };
}

export type KitStarDraft = {
  questionKey: string;
  questionText: string;
  answer_text: string;
  improved_text: string;
  score: number;
  recommendations: string[];
  updated_at: string | null;
};

export function buildKitStarDraftsPayload(
  practiceAnswers: KitPracticeAnswer[],
  starDrafts: unknown
): KitStarDraft[] {
  const practiceDrafts = practiceAnswers
    .filter((answer) => Boolean(answer.answer_text?.trim()))
    .map((answer) => ({
      questionKey: answer.question_key,
      questionText: answer.question_text ?? "",
      answer_text: answer.answer_text ?? "",
      improved_text: answer.improved_text ?? "",
      score: answer.score ?? 0,
      recommendations: Array.isArray(answer.rubric_json?.recommendations)
        ? answer.rubric_json?.recommendations ?? []
        : [],
      updated_at: answer.updated_at ?? null,
    }));

  if (practiceDrafts.length > 0) {
    return practiceDrafts;
  }

  if (Array.isArray(starDrafts)) {
    return starDrafts.map((draft, index) => {
      const draftValue = draft as { question?: string; requirement?: string; answer?: string };
      return {
        questionKey: `draft-${index + 1}`,
        questionText:
          draftValue.question || draftValue.requirement || `STAR draft ${index + 1}`,
        answer_text: draftValue.answer ?? "",
        improved_text: "",
        score: 0,
        recommendations: [],
        updated_at: null,
      };
    });
  }

  return [];
}
