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
  doneAt?: string | null;
  actionHref?: string | null;
};

export type KitNextAction = {
  id: string;
  label: string;
  href: string;
  reason?: string;
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
  checklist: ApplyChecklistSnapshot | null;
  closingDate?: string | null;
  submittedAt?: string | null;
  nextActionDue?: string | null;
  outreachStage?: string | null;
  practiceQuestions: PracticeQuestion[];
  practiceAnswers: Record<string, PracticeAnswerSnapshot>;
  starDrafts: unknown;
  activities: Array<{ type: string; occurred_at?: string | null }>;
};

const KIT_CONTENTS = [
  "01_CV_ATS-Minimal.docx",
  "02_Cover-Letter_ATS-Minimal.docx",
  "03_Interview-Pack_Standard.docx",
  "04_STAR-Drafts.json",
];

export type ApplyChecklistSnapshot = {
  cv_exported_at?: string | null;
  cover_exported_at?: string | null;
  interview_pack_exported_at?: string | null;
  kit_downloaded_at?: string | null;
  outreach_step1_logged_at?: string | null;
  followup_scheduled_at?: string | null;
  submitted_logged_at?: string | null;
};

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

  const outreachActivity = input.activities.find(
    (activity) => activity.type === "outreach"
  );
  const outreachDoneAt =
    input.checklist?.outreach_step1_logged_at ??
    outreachActivity?.occurred_at ??
    null;
  const outreachOk =
    Boolean(input.outreachStage && input.outreachStage !== "not_started") ||
    Boolean(outreachDoneAt);

  const followupActivity = input.activities.find(
    (activity) => activity.type === "followup.scheduled"
  );
  const followupDoneAt =
    input.checklist?.followup_scheduled_at ??
    followupActivity?.occurred_at ??
    toDateOnlyTimestamp(input.nextActionDue);
  const followupOk = Boolean(followupDoneAt);

  const submittedDoneAt =
    input.checklist?.submitted_logged_at ?? input.submittedAt ?? null;
  const submittedOk = Boolean(submittedDoneAt);

  const items: KitChecklistItem[] = [
    {
      id: "cv_exported",
      label: "CV exported",
      ok: Boolean(input.checklist?.cv_exported_at),
      hint: input.checklist?.cv_exported_at
        ? "CV export completed."
        : "Export the CV (ATS-Minimal).",
      doneAt: input.checklist?.cv_exported_at ?? null,
      actionHref: `/app/applications/${input.applicationId}?tab=apply`,
    },
    {
      id: "cover_exported",
      label: "Cover letter exported",
      ok: Boolean(input.checklist?.cover_exported_at),
      hint: input.checklist?.cover_exported_at
        ? "Cover letter export completed."
        : "Export the cover letter (ATS-Minimal).",
      doneAt: input.checklist?.cover_exported_at ?? null,
      actionHref: `/app/applications/${input.applicationId}?tab=apply`,
    },
    {
      id: "interview_pack_exported",
      label: "Interview pack exported",
      ok: Boolean(input.checklist?.interview_pack_exported_at),
      hint: input.checklist?.interview_pack_exported_at
        ? "Interview pack export completed."
        : "Export the interview pack.",
      doneAt: input.checklist?.interview_pack_exported_at ?? null,
      actionHref: `/app/applications/${input.applicationId}?tab=interview`,
    },
    {
      id: "kit_downloaded",
      label: "Kit downloaded",
      ok: Boolean(input.checklist?.kit_downloaded_at),
      hint: input.checklist?.kit_downloaded_at
        ? "Kit download completed."
        : "Download the Application Kit ZIP.",
      doneAt: input.checklist?.kit_downloaded_at ?? null,
      actionHref: `/app/applications/${input.applicationId}?tab=apply`,
    },
    {
      id: "outreach_step1",
      label: "Outreach step 1 logged",
      ok: outreachOk,
      hint: outreachOk
        ? "Outreach step logged."
        : "Send outreach step 1.",
      doneAt: outreachDoneAt,
      actionHref: `/app/applications/${input.applicationId}?tab=activity`,
    },
    {
      id: "followup_scheduled",
      label: "Follow-up scheduled",
      ok: followupOk,
      hint: followupOk
        ? "Follow-up scheduled."
        : "Schedule a follow-up reminder.",
      doneAt: followupDoneAt,
      actionHref: `/app/applications/${input.applicationId}?tab=activity`,
    },
    {
      id: "submitted",
      label: "Submitted",
      ok: submittedOk,
      hint: submittedOk ? "Application marked as submitted." : "Mark as submitted.",
      doneAt: submittedDoneAt,
      actionHref: `/app/applications/${input.applicationId}?tab=apply`,
    },
  ];

  const readinessScore =
    (profileOk ? 10 : 0) +
    (metricsOk ? 20 : 0) +
    (autopackExists ? 15 : 0) +
    (exportReady ? 15 : 0) +
    (practiceOk ? 20 : 0) +
    (starOk ? 10 : 0) +
    (outreachOk ? 10 : 0);

  const nextActions: KitNextAction[] = [];

  if (!autopackExists) {
      nextActions.push({
        id: "autopack",
        label: "Generate Autopack",
        href: `/app/applications/${input.applicationId}?tab=apply`,
      reason: "Required to unlock kit exports and readiness checks.",
    });
  }

  const closingUrgent =
    Boolean(input.closingDate) &&
    !submittedOk &&
    daysUntil(input.closingDate) <= 3;
  if (closingUrgent) {
      nextActions.push({
        id: "closing",
        label: "Apply today and export the kit",
        href: `/app/applications/${input.applicationId}?tab=apply`,
      reason: "Closing date is within 3 days.",
    });
  }

  if (autopackExists && !exportReady && input.autopack?.id) {
    nextActions.push({
      id: "export",
      label: "Fix placeholders / add company specifics",
      href: `/app/applications/${input.applicationId}/autopacks/${input.autopack.id}`,
      reason: "Exports still contain placeholders or missing context.",
    });
  }

  if (autopackExists && !input.checklist?.kit_downloaded_at) {
    nextActions.push({
      id: "kit",
      label: "Download Application Kit ZIP",
      href: `/app/applications/${input.applicationId}#application-kit`,
      reason: "Bundle the ready-to-submit documents.",
    });
  }

  if (!outreachOk && !submittedOk) {
    nextActions.push({
      id: "outreach",
      label: "Send outreach Step 1",
      href: "/app/pipeline",
      reason: "Boost visibility before submitting.",
    });
  }

  if (submittedOk && !followupOk) {
    nextActions.push({
      id: "followup",
      label: "Schedule follow-up in 3 business days",
      href: `/app/applications/${input.applicationId}#smart-apply`,
      reason: "Keep the application warm after submission.",
    });
  }

  if (!practiceOk) {
    nextActions.push({
      id: "practice",
      label: "Score your 2 lowest questions in Drill Mode",
      href: `/app/applications/${input.applicationId}/practice/drill`,
      reason: "Raise interview readiness quickly.",
    });
  }

  if (!metricsOk) {
    nextActions.push({
      id: "metrics",
      label: "Add 1 metric to an achievement",
      href: "/app/profile#achievements",
      reason: "Metrics improve CV and interview impact.",
    });
  }

  if (!starOk) {
    nextActions.push({
      id: "star",
      label: "Create 1 STAR draft from a scored question",
      href: `/app/applications/${input.applicationId}/practice`,
      reason: "Strengthen examples for common questions.",
    });
  }

  return {
    items,
    score: Math.min(readinessScore, 100),
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

function daysUntil(value?: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const now = new Date();
  const diff = parsed.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function toDateOnlyTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return new Date(`${trimmed}T12:00:00Z`).toISOString();
}

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
