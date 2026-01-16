"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import type { InterviewPracticeScore } from "@/lib/interview-practice";
import type { InterviewRewriteNotes } from "@/lib/interview-rewrite";
import { formatStarDraft } from "@/lib/star-library";
import {
  inferQuestionType,
  type AnswerPackVariant,
} from "@/lib/interview/answer-pack";
import {
  deriveStatus,
  orderPracticeQuestions,
  type OrderedPracticeQuestion,
} from "@/lib/practice-dashboard";
import {
  buildCopyAllText,
  computeAnswerPackReadiness,
} from "@/lib/answer-pack-ui";
import { needsHardGate, shouldSoftGate } from "@/lib/billing/gating";
import CreditGateModal from "@/app/app/billing/credit-gate-modal";
import {
  savePendingAction,
  buildReturnToUrl,
} from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { getActionRoiLine } from "@/lib/billing/action-roi";

type DrillQuestion = {
  questionKey: string;
  questionText: string;
  signals: string[];
};

type PracticeAnswer = {
  question_key?: string;
  question_text?: string | null;
  answer_text?: string | null;
  rubric_json?: InterviewPracticeScore | null;
  score?: number | null;
  improved_text?: string | null;
  improved_meta?: InterviewRewriteNotes | null;
  improved_updated_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type DrillClientProps = {
  applicationId: string;
  questions: DrillQuestion[];
  orderedKeys: string[];
  initialIndex: number;
  initialQuestionKey: string | null;
  initialRewriteOpen: boolean;
  gapLabels: string[];
  questionGapMap: Record<string, string | null>;
  starLibraryMap: Record<
    string,
    {
      id: string;
      title: string;
      situation: string;
      task: string;
      action: string;
      result: string;
    }
  >;
  initialAnswers: Record<string, PracticeAnswer>;
  balance: number;
  returnTo?: string;
};

type AnswerPackPanelProps = {
  variant: AnswerPackVariant;
  entry: AnswerPackEntry | null;
  question: string;
  onCopy: (text: string) => void;
  onApply: () => void;
  applying: boolean;
};

function AnswerPackPanel({
  variant,
  entry,
  question,
  onCopy,
  onApply,
  applying,
}: AnswerPackPanelProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const items = entry
    ? [
        {
          question: question || "Interview question",
          answer: entry.answerText ?? "",
        },
      ]
    : [];
  const { readyCount, total } = computeAnswerPackReadiness(items);
  const copyAll = () => {
    const text = buildCopyAllText(items);
    if (text) {
      onCopy(text);
    }
  };

  if (!entry) {
    return (
      <div className="mt-3 text-xs text-[rgb(var(--muted))]">
        No answer generated yet for this question.{" "}
        <a
          href="?tab=evidence"
          className="font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
        >
          Create STAR drafts first.
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
        <span className="font-semibold text-[rgb(var(--ink))]">
          Ready: {readyCount} / {total}
        </span>
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1 text-xs"
          onClick={copyAll}
        >
          Copy all ({variant})
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => {
          const isExpanded = expanded[index] ?? false;
          const ready = Boolean(item.answer && item.answer.trim());
          return (
            <div
              key={index}
              className="rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [index]: !isExpanded,
                      }))
                    }
                    className="font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                  >
                    {item.question.length > 60
                      ? `${item.question.slice(0, 60)}…`
                      : item.question}
                  </button>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ready
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {ready ? "Ready" : "Empty"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1 text-[10px]"
                    onClick={() => onCopy(item.answer)}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    className="px-3 py-1 text-[10px]"
                    onClick={onApply}
                    disabled={applying}
                  >
                    {applying ? "Applying..." : "Apply to draft"}
                  </Button>
                </div>
              </div>
              {isExpanded ? (
                <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--muted))]">
                  {item.answer}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ToastState = { message: string; variant?: "success" | "error" };

type AnswerPackEntry = {
  answerText: string;
  variant: AnswerPackVariant;
  questionType: string;
  starLibraryId: string;
  starGapKey: string;
  starTitle?: string | null;
};

function normaliseRubric(value: unknown): InterviewPracticeScore | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const rubric = value as InterviewPracticeScore;
  if (!rubric.breakdown || !rubric.flags || !rubric.recommendations) {
    return null;
  }
  return rubric;
}

function normaliseRewriteNotes(value: unknown): InterviewRewriteNotes | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const notes = value as InterviewRewriteNotes;
  if (
    !Array.isArray(notes.changes) ||
    !Array.isArray(notes.insertedPlaceholders) ||
    !notes.structure ||
    !notes.length
  ) {
    return null;
  }
  return notes;
}

export default function DrillClient({
  applicationId,
  questions,
  orderedKeys,
  initialIndex,
  initialQuestionKey,
  initialRewriteOpen,
  gapLabels,
  questionGapMap,
  starLibraryMap,
  initialAnswers,
  balance,
  returnTo,
}: DrillClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, PracticeAnswer>>(
    initialAnswers
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(initialAnswers).forEach(([key, value]) => {
      initial[key] = value.answer_text ?? "";
    });
    return initial;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showRewrite, setShowRewrite] = useState(initialRewriteOpen);
  const [answerPack, setAnswerPack] = useState<{
    standard: AnswerPackEntry | null;
    short90: AnswerPackEntry | null;
  }>({ standard: null, short90: null });
  const [answerPackVariant, setAnswerPackVariant] =
    useState<AnswerPackVariant>("short90");
  const [answerPackLoading, setAnswerPackLoading] = useState(false);
  const [answerPackError, setAnswerPackError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [pendingVariant, setPendingVariant] =
    useState<AnswerPackVariant>("short90");

  const currentReturn =
    returnTo ??
    `${pathname}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;

  const questionMap = useMemo(() => {
    return questions.reduce((acc, question) => {
      acc[question.questionKey] = question;
      return acc;
    }, {} as Record<string, DrillQuestion>);
  }, [questions]);

  const currentKey = orderedKeys[currentIndex] ?? orderedKeys[0];
  const currentQuestion = questionMap[currentKey];
  const currentAnswer = answers[currentKey] ?? {};
  const currentDraft = drafts[currentKey] ?? "";
  const rubric = currentAnswer.rubric_json ?? null;
  const score = currentAnswer.score ?? 0;
  const improvedText = currentAnswer.improved_text ?? "";
  const improvedNotes = currentAnswer.improved_meta ?? null;
  const improvedUpdatedAt = currentAnswer.improved_updated_at ?? null;
  const answerUpdatedAt = currentAnswer.updated_at ?? null;

  const draftChanged =
    currentDraft.trim() !== (currentAnswer.answer_text ?? "").trim();
  const isOutOfDate =
    Boolean(improvedText) &&
    (draftChanged ||
      (improvedUpdatedAt &&
        answerUpdatedAt &&
        new Date(answerUpdatedAt).getTime() >
          new Date(improvedUpdatedAt).getTime()));

  const status = deriveStatus({
    ...currentAnswer,
    answer_text: currentDraft,
  });
  const currentGapKey = questionGapMap[currentKey] ?? null;
  const starDraft = currentGapKey ? starLibraryMap[currentGapKey] : null;
  const starDraftText = starDraft
    ? formatStarDraft({
        situation: starDraft.situation,
        task: starDraft.task,
        action: starDraft.action,
        result: starDraft.result,
      })
    : "";

  const orderedQuestions = useMemo<OrderedPracticeQuestion[]>(
    () =>
      orderPracticeQuestions(
        questions.map((question) => ({
          questionKey: question.questionKey,
          questionText: question.questionText,
        })),
        answers
      ),
    [questions, answers]
  );

  const setDraft = (value: string) => {
    setDrafts((prev) => ({ ...prev, [currentKey]: value }));
  };

  const loadAnswerPack = useCallback(async (questionKey: string) => {
    setAnswerPackLoading(true);
    setAnswerPack({ standard: null, short90: null });
    try {
      const response = await fetch(
        `/api/answer-pack?applicationId=${applicationId}&questionKey=${encodeURIComponent(questionKey)}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAnswerPackError(payload?.error ?? "Unable to load answer pack.");
        return;
      }
      setAnswerPack({
        standard: payload?.standard ?? null,
        short90: payload?.short90 ?? null,
      });
    } catch (error) {
      console.error("[answer-pack.load]", error);
      setAnswerPackError("Unable to load answer pack.");
    } finally {
      setAnswerPackLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        applicationId?: string;
        mode?: AnswerPackVariant;
      };
      if (detail?.applicationId === applicationId) {
        void handleGenerateAnswer(detail.mode ?? "short90");
      }
    };
    window.addEventListener("cvf-resume-answer-pack", handler);
    return () => window.removeEventListener("cvf-resume-answer-pack", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    if (!currentKey) {
      return;
    }
    if (initialQuestionKey && currentKey === initialQuestionKey) {
      setShowRewrite(initialRewriteOpen);
    } else {
      setShowRewrite(false);
    }
    setShowBreakdown(false);
    setAnswerPackError(null);
    setAnswerPackVariant("short90");
    void loadAnswerPack(currentKey);
  }, [currentKey, initialQuestionKey, initialRewriteOpen, loadAnswerPack]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied.", variant: "success" });
    } catch (error) {
      console.error("[practice-drill.copy]", error);
      setToast({ message: "Unable to copy right now.", variant: "error" });
    }
  };

  const handleGenerateAnswer = async (variant: AnswerPackVariant) => {
    if (!currentQuestion) {
      return;
    }
    if (needsHardGate(balance, 1)) {
      savePendingAction({
        type: "answer_pack_generate",
        applicationId,
        mode: variant === "short90" ? "short90" : "standard",
        returnTo: buildReturnToUrl({
          type: "answer_pack_generate",
          applicationId,
          mode: variant === "short90" ? "short90" : "standard",
          createdAt: Date.now(),
        } as any),
        createdAt: Date.now(),
      });
      logMonetisationClientEvent("gate_blocked", applicationId, "applications", {
        actionKey: "answer_pack_generate",
        variant,
      });
      logMonetisationClientEvent("billing_clicked", applicationId, "applications", {
        actionKey: "answer_pack_generate",
        variant,
      });
      router.push(`/app/billing?returnTo=${encodeURIComponent(currentReturn)}`);
      return;
    }
    if (shouldSoftGate(balance, 1)) {
      setPendingVariant(variant);
      savePendingAction({
        type: "answer_pack_generate",
        applicationId,
        mode: variant === "short90" ? "short90" : "standard",
        returnTo: buildReturnToUrl({
          type: "answer_pack_generate",
          applicationId,
          mode: variant === "short90" ? "short90" : "standard",
          createdAt: Date.now(),
        } as any),
        createdAt: Date.now(),
      });
      logMonetisationClientEvent("gate_shown", applicationId, "applications", {
        actionKey: "answer_pack_generate",
        variant,
      });
      setShowGate(true);
      return;
    }
    setAnswerPackError(null);
    setAnswerPackLoading(true);
    try {
      const response = await fetch("/api/answer-pack/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          questionKey: currentKey,
          questionText: currentQuestion.questionText,
          signals: currentQuestion.signals,
          questionType: inferQuestionType(
            currentQuestion.questionText,
            currentQuestion.signals
          ),
          variant,
          starGapKey: currentGapKey ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAnswerPackError(payload?.error ?? "Unable to generate answer.");
        return;
      }
      const entry: AnswerPackEntry = {
        answerText: payload.answerText,
        variant: payload.variant,
        questionType: payload.questionType,
        starLibraryId: payload.starLibraryId,
        starGapKey: payload.starGapKey,
        starTitle: payload.starTitle ?? null,
      };
      setAnswerPack((prev) => ({
        ...prev,
        [variant]: entry,
      }));
      setAnswerPackVariant(variant);
      setToast({ message: "Answer generated.", variant: "success" });
    } catch (error) {
      console.error("[answer-pack.generate]", error);
      setAnswerPackError("Unable to generate answer.");
    } finally {
      setAnswerPackLoading(false);
    }
  };

  const handleApplyAnswer = async (variant: AnswerPackVariant) => {
    const entry = answerPack[variant];
    if (!entry) {
      setAnswerPackError("Generate an answer first.");
      return;
    }
    setPendingKey(`apply-${currentKey}-${variant}`);
    try {
      const response = await fetch("/api/answer-pack/apply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          questionKey: currentKey,
          questionText: currentQuestion?.questionText,
          variant,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAnswerPackError(payload?.error ?? "Unable to apply answer.");
        return;
      }
      setDraft(entry.answerText);
      setToast({ message: "Applied to draft.", variant: "success" });
    } catch (error) {
      console.error("[answer-pack.apply]", error);
      setAnswerPackError("Unable to apply answer.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleScore = async (overrideText?: string) => {
    if (!currentQuestion) {
      return;
    }
    const answerText = (overrideText ?? currentDraft).trim();
    if (!answerText) {
      setToast({ message: "Add an answer before scoring.", variant: "error" });
      return;
    }

    if (overrideText !== undefined) {
      setDraft(overrideText);
    }

    setPendingKey(`score-${currentKey}`);
    try {
      const response = await fetch("/api/interview-practice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          questionKey: currentKey,
          questionText: currentQuestion.questionText,
          answerText,
          meta: {
            signals: currentQuestion.signals,
            gaps: gapLabels,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to save answer.",
          variant: "error",
        });
        return;
      }

      const rubricValue =
        normaliseRubric(payload?.scoring) ??
        normaliseRubric(payload?.answer?.rubric_json) ??
        null;
      const saved = payload?.answer ?? {};

      setAnswers((prev) => ({
        ...prev,
        [currentKey]: {
          ...prev[currentKey],
          question_key: currentKey,
          question_text: saved.question_text ?? currentQuestion.questionText,
          answer_text: saved.answer_text ?? answerText,
          rubric_json: rubricValue,
          score: rubricValue?.totalScore ?? saved.score ?? 0,
          improved_text: saved.improved_text ?? prev[currentKey]?.improved_text ?? "",
          improved_meta:
            normaliseRewriteNotes(saved.improved_meta) ??
            prev[currentKey]?.improved_meta ??
            null,
          improved_updated_at:
            saved.improved_updated_at ?? prev[currentKey]?.improved_updated_at ?? null,
          updated_at: saved.updated_at ?? prev[currentKey]?.updated_at ?? null,
          created_at: saved.created_at ?? prev[currentKey]?.created_at ?? null,
        },
      }));

      setToast({ message: "Answer saved.", variant: "success" });
    } catch (error) {
      console.error("[practice-drill.score]", error);
      setToast({ message: "Unable to save answer.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleRewrite = async () => {
    if (!currentQuestion) {
      return;
    }
    const answerText = currentDraft.trim();
    if (!answerText) {
      setToast({ message: "Add an answer before rewriting.", variant: "error" });
      return;
    }

    setPendingKey(`rewrite-${currentKey}`);
    try {
      const response = await fetch("/api/interview-practice/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          questionKey: currentKey,
          questionText: currentQuestion.questionText,
          answerText,
          meta: {
            signals: currentQuestion.signals,
            gaps: gapLabels,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to rewrite answer.",
          variant: "error",
        });
        return;
      }

      const rubricValue =
        normaliseRubric(payload?.scoring) ??
        normaliseRubric(payload?.answer?.rubric_json) ??
        null;
      const saved = payload?.answer ?? {};

      setAnswers((prev) => ({
        ...prev,
        [currentKey]: {
          ...prev[currentKey],
          question_key: currentKey,
          question_text: saved.question_text ?? currentQuestion.questionText,
          answer_text: saved.answer_text ?? answerText,
          rubric_json: rubricValue,
          score: rubricValue?.totalScore ?? saved.score ?? 0,
          improved_text: saved.improved_text ?? payload?.improvedText ?? "",
          improved_meta:
            normaliseRewriteNotes(payload?.notes) ??
            normaliseRewriteNotes(saved.improved_meta) ??
            null,
          improved_updated_at:
            saved.improved_updated_at ?? prev[currentKey]?.improved_updated_at ?? null,
          updated_at: saved.updated_at ?? prev[currentKey]?.updated_at ?? null,
          created_at: saved.created_at ?? prev[currentKey]?.created_at ?? null,
        },
      }));

      setShowRewrite(true);
      setToast({ message: "Rewrite ready.", variant: "success" });
    } catch (error) {
      console.error("[practice-drill.rewrite]", error);
      setToast({ message: "Unable to rewrite answer.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleApplyImproved = async () => {
    if (!improvedText) {
      setToast({ message: "Generate a rewrite first.", variant: "error" });
      return;
    }
    if (isOutOfDate) {
      setToast({ message: "Rewrite is out of date. Regenerate first.", variant: "error" });
      return;
    }
    await handleScore(improvedText);
    setShowRewrite(false);
  };

  const goToIndex = (index: number) => {
    if (index < 0 || index >= orderedKeys.length) {
      return;
    }
    setCurrentIndex(index);
  };

  const handleNextPriority = () => {
    if (!currentKey) {
      return;
    }
    const priorityKeys = orderedQuestions.map((question) => question.questionKey);
    const nextKey = priorityKeys.find((key) => key !== currentKey);
    if (!nextKey) {
      return;
    }
    const nextIndex = orderedKeys.indexOf(nextKey);
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
    }
  };

  const hasQuestion = Boolean(currentQuestion);
  const total = orderedKeys.length;
  const displayIndex = Math.min(currentIndex + 1, total);

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`rounded-2xl border p-3 text-sm ${
            toast.variant === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Drill Mode
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Question {displayIndex} of {total}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status.drafted ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                Drafted
              </span>
            ) : null}
            {status.scored ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                Scored
              </span>
            ) : null}
            {status.improved ? (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700">
                Improved
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                score >= 80
                  ? "bg-emerald-100 text-emerald-700"
                  : score >= 60
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              Score {score}
            </span>
          </div>
        </div>

        {hasQuestion ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--ink))]">
              {currentQuestion.questionText}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <label className="text-xs font-semibold text-[rgb(var(--muted))]">
                Draft answer
                <textarea
                  value={currentDraft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={8}
                  className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                <span>{currentDraft.length} characters</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => handleScore()}
                    disabled={pendingKey === `score-${currentKey}`}
                  >
                    {pendingKey === `score-${currentKey}`
                      ? "Saving..."
                      : "Save & score"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRewrite}
                    disabled={
                      pendingKey === `rewrite-${currentKey}` || !currentDraft.trim()
                    }
                  >
                    {pendingKey === `rewrite-${currentKey}`
                      ? "Rewriting..."
                      : "Generate improved"}
                  </Button>
                </div>
              </div>
              {starDraft ? (
                <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[rgb(var(--ink))]">
                      STAR ready · {starDraft.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft(starDraftText)}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                    >
                      Use STAR draft
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">
                    Paste the draft as a starting point, then tailor it to this
                    question.
                  </p>
                </div>
              ) : null}
            </div>

            {rubric ? (
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[rgb(var(--ink))]">
                    Score breakdown
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBreakdown((prev) => !prev)}
                    className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                  >
                    {showBreakdown ? "Hide" : "View"}
                  </button>
                </div>
                {showBreakdown ? (
                  <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--muted))] sm:grid-cols-2">
                    <span>Situation: {rubric.breakdown.situation}/20</span>
                    <span>Task: {rubric.breakdown.task}/20</span>
                    <span>Action: {rubric.breakdown.action}/20</span>
                    <span>Result: {rubric.breakdown.result}/20</span>
                    <span>Metrics: {rubric.breakdown.metrics}/20</span>
                    <span>Relevance: {rubric.breakdown.relevance}/20</span>
                  </div>
                ) : null}

                {rubric.recommendations.length ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
                    <p className="font-semibold text-[rgb(var(--ink))]">
                      Recommendations
                    </p>
                    <ul className="mt-2 space-y-1">
                      {rubric.recommendations.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            [
                              "Interview practice improvements:",
                              ...rubric.recommendations.map(
                                (item) => `- ${item}`
                              ),
                              rubric.flags?.missingMetrics
                                ? "- Add a measurable metric (%, time saved, cost, risk reduction)."
                                : null,
                            ]
                              .filter(Boolean)
                              .join("\n")
                          )
                        }
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                      >
                        Copy improved checklist
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[rgb(var(--ink))]">
                  Rewrite Coach
                </p>
                {improvedText ? (
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      isOutOfDate
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {isOutOfDate ? "Out of date" : "Ready"}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                Deterministic rewrite — no new facts are added.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRewrite((prev) => !prev)}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                >
                  {showRewrite ? "Hide" : "View"}
                </button>
                {improvedText ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(improvedText)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  >
                    Copy improved
                  </button>
                ) : null}
              </div>

              {showRewrite ? (
                improvedText ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-dashed border-black/10 bg-white/70 p-3">
                        <p className="text-[10px] font-semibold text-[rgb(var(--ink))]">
                          Original
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--muted))]">
                          {currentDraft || "No draft yet."}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-dashed border-black/10 bg-white/70 p-3">
                        <p className="text-[10px] font-semibold text-[rgb(var(--ink))]">
                          Improved
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--muted))]">
                          {improvedText}
                        </pre>
                      </div>
                    </div>

                    {improvedNotes?.changes?.length ? (
                      <div className="rounded-xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
                        <p className="font-semibold text-[rgb(var(--ink))]">
                          What changed
                        </p>
                        <ul className="mt-2 space-y-1">
                          {improvedNotes.changes.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleApplyImproved}
                        disabled={
                          !improvedText || isOutOfDate || pendingKey === `score-${currentKey}`
                        }
                      >
                        Apply improved
                      </Button>
                      {isOutOfDate ? (
                        <span className="text-[10px] text-[rgb(var(--muted))]">
                          Regenerate before applying.
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                    Generate an improved version to preview the rewrite.
                  </p>
                )
              ) : null}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[rgb(var(--ink))]">
                    Answer Pack
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    Deterministic answers from STAR drafts. No AI rewriting.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setAnswerPackVariant("short90")}
                    className={`rounded-full border px-3 py-1 font-semibold ${
                      answerPackVariant === "short90"
                        ? "border-emerald-200 bg-emerald-600 text-white"
                        : "border-black/10 bg-white text-[rgb(var(--ink))]"
                    }`}
                  >
                    90-second
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerPackVariant("standard")}
                    className={`rounded-full border px-3 py-1 font-semibold ${
                      answerPackVariant === "standard"
                        ? "border-emerald-200 bg-emerald-600 text-white"
                        : "border-black/10 bg-white text-[rgb(var(--ink))]"
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => handleGenerateAnswer(answerPackVariant)}
                  disabled={answerPackLoading}
                >
                  {answerPackLoading ? "Generating..." : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleGenerateAnswer("short90")}
                  disabled={answerPackLoading}
                >
                  Generate 90-second
                </Button>
              </div>

              {answerPackError ? (
                <p className="mt-2 text-xs text-red-600">{answerPackError}</p>
              ) : null}

              <AnswerPackPanel
                variant={answerPackVariant}
                entry={answerPack[answerPackVariant]}
                onCopy={(text) => handleCopy(text)}
                onApply={() => handleApplyAnswer(answerPackVariant)}
                applying={
                  pendingKey === `apply-${currentKey}-${answerPackVariant}`
                }
                question={currentQuestion?.questionText ?? ""}
              />
              <CreditGateModal
                open={showGate}
                onClose={() => setShowGate(false)}
                cost={1}
                balance={balance}
                actionLabel="Generate Answer Pack"
                roiLine={getActionRoiLine("answerPack.generate")}
                referralHref="/app/billing#refer"
                onContinue={() => {
                  setShowGate(false);
                  handleGenerateAnswer(pendingVariant);
                }}
                onGoBilling={() => {
                  logMonetisationClientEvent(
                    "billing_clicked",
                    applicationId,
                    "applications",
                    { actionKey: "answer_pack_generate", variant: pendingVariant }
                  );
                  router.push(
                    `/app/billing?returnTo=${encodeURIComponent(currentReturn)}`
                  );
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goToIndex(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goToIndex(currentIndex + 1)}
                  disabled={currentIndex >= orderedKeys.length - 1}
                >
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={handleNextPriority}>
                  Next priority
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-[rgb(var(--muted))]">
            No practice questions available for this application yet.
          </div>
        )}
      </div>
    </div>
  );
}
