"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { InterviewPack, InterviewPackWeakSpot } from "@/lib/interview-pack";
import type { ExportVariant } from "@/lib/export/export-utils";
import {
  buildQuestionKey,
  type InterviewPracticeScore,
} from "@/lib/interview-practice";

type InterviewPackPanelProps = {
  applicationId: string;
  pack: InterviewPack;
  achievements: Array<{ id: string; title: string; metrics: string | null }>;
};

type ToastState = { message: string; variant?: "success" | "error" };

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

type PracticeAnswer = {
  question_key: string;
  question_text: string;
  answer_text: string;
  rubric_json: InterviewPracticeScore | null;
  score: number;
  updated_at?: string | null;
  created_at?: string | null;
};

function getFilenameFromDisposition(
  disposition: string | null,
  fallback: string
) {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename="(.+?)"/);
  return match?.[1] ?? fallback;
}

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

export default function InterviewPackPanel({
  applicationId,
  pack,
  achievements,
}: InterviewPackPanelProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [variant, setVariant] = useState<ExportVariant>("standard");
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
  });
  const [selectedAchievementId, setSelectedAchievementId] = useState(
    achievements[0]?.id ?? ""
  );
  const [practiceEnabled, setPracticeEnabled] = useState(false);
  const [practiceLoaded, setPracticeLoaded] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<string, PracticeAnswer>
  >({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openDrafts, setOpenDrafts] = useState<Record<string, boolean>>({});
  const [openBreakdowns, setOpenBreakdowns] = useState<Record<string, boolean>>(
    {}
  );

  const questionsWithKeys = useMemo(
    () =>
      pack.questions.map((question, index) => ({
        ...question,
        questionKey: buildQuestionKey(question.question, index),
      })),
    [pack.questions]
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (achievements.length) {
      setSelectedAchievementId((prev) => prev || achievements[0].id);
    }
  }, [achievements]);

  useEffect(() => {
    if (!practiceEnabled || practiceLoaded) {
      return;
    }
    let active = true;
    setPracticeLoading(true);

    fetch(`/api/interview-practice?applicationId=${applicationId}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? "Unable to load practice answers.");
        }
        return response.json();
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        const answers = Array.isArray(payload?.answers) ? payload.answers : [];
        const map: Record<string, PracticeAnswer> = {};
        const initialDrafts: Record<string, string> = {};

        answers.forEach((answer: any) => {
          const key = String(answer.question_key ?? "");
          if (!key) {
            return;
          }
          const rubric = normaliseRubric(answer.rubric_json);
          const score =
            typeof answer.score === "number"
              ? answer.score
              : rubric?.totalScore ?? 0;
          map[key] = {
            question_key: key,
            question_text: answer.question_text ?? "",
            answer_text: answer.answer_text ?? "",
            rubric_json: rubric,
            score,
            updated_at: answer.updated_at ?? null,
            created_at: answer.created_at ?? null,
          };
          initialDrafts[key] = answer.answer_text ?? "";
        });

        setPracticeAnswers(map);
        setDrafts((prev) => ({ ...prev, ...initialDrafts }));
        setPracticeLoaded(true);
      })
      .catch((error) => {
        console.error("[interview-pack.practice.fetch]", error);
        if (active) {
          setToast({
            message: "Unable to load practice answers.",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (active) {
          setPracticeLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [applicationId, practiceEnabled, practiceLoaded]);

  const hasAchievements = achievements.length > 0;

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied.", variant: "success" });
    } catch (error) {
      console.error("[interview-pack.copy]", error);
      setToast({ message: "Unable to copy right now.", variant: "error" });
    }
  };

  const handleAddEvidence = async (spot: InterviewPackWeakSpot) => {
    const title = spot.label || "Role evidence";
    const action =
      spot.actionSuggestion ||
      `Delivered outcomes aligned to ${spot.label || "the role"}.`;
    setPendingKey(`evidence-${spot.id}`);

    try {
      const response = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to add achievement right now.",
          variant: "error",
        });
        return;
      }
      setToast({ message: "Evidence line added.", variant: "success" });
      router.refresh();
    } catch (error) {
      console.error("[interview-pack.add-evidence]", error);
      setToast({ message: "Unable to add achievement right now.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleAddMetric = async (spot: InterviewPackWeakSpot) => {
    if (!selectedAchievementId) {
      setToast({ message: "Choose an achievement first.", variant: "error" });
      return;
    }
    const metric = spot.metricSuggestions[0];
    if (!metric) {
      setToast({ message: "No metric suggestion available.", variant: "error" });
      return;
    }
    setPendingKey(`metric-${spot.id}`);

    try {
      const response = await fetch(`/api/achievements/${selectedAchievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ metrics: metric }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to update metrics right now.",
          variant: "error",
        });
        return;
      }
      setToast({ message: "Metric added.", variant: "success" });
      router.refresh();
    } catch (error) {
      console.error("[interview-pack.add-metric]", error);
      setToast({ message: "Unable to update metrics right now.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleStarDraft = async () => {
    if (!selectedAchievementId) {
      setToast({ message: "Choose an achievement first.", variant: "error" });
      return;
    }
    setPendingKey("star-draft");

    try {
      const response = await fetch(`/api/applications/${applicationId}/star-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ achievementId: selectedAchievementId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to draft STAR answer right now.",
          variant: "error",
        });
        return;
      }
      setToast({ message: "STAR draft created.", variant: "success" });
      router.refresh();
    } catch (error) {
      console.error("[interview-pack.star-draft]", error);
      setToast({ message: "Unable to draft STAR answer right now.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleScoreAnswer = async (
    questionKey: string,
    questionText: string,
    signals: string[]
  ) => {
    const answerText = drafts[questionKey] ?? "";
    if (!answerText.trim()) {
      setToast({ message: "Add an answer before scoring.", variant: "error" });
      return;
    }
    setPendingKey(`score-${questionKey}`);

    try {
      const response = await fetch("/api/interview-practice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          questionKey,
          questionText,
          answerText,
          meta: {
            signals,
            gaps: pack.weakSpots.map((spot) => spot.label),
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to score answer right now.",
          variant: "error",
        });
        return;
      }

      const rubric = normaliseRubric(payload?.scoring) ?? null;
      const saved = payload?.answer ?? {};
      setPracticeAnswers((prev) => ({
        ...prev,
        [questionKey]: {
          question_key: questionKey,
          question_text: saved.question_text ?? questionText,
          answer_text: saved.answer_text ?? answerText,
          rubric_json: rubric,
          score: rubric?.totalScore ?? saved.score ?? 0,
          updated_at: saved.updated_at ?? null,
          created_at: saved.created_at ?? null,
        },
      }));

      setToast({ message: "Answer scored.", variant: "success" });
    } catch (error) {
      console.error("[interview-pack.practice.score]", error);
      setToast({ message: "Unable to score answer right now.", variant: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const handleCopyChecklist = (questionKey: string) => {
    const rubric = practiceAnswers[questionKey]?.rubric_json;
    if (!rubric) {
      setToast({ message: "Score the answer first.", variant: "error" });
      return;
    }
    const lines = ["Interview practice improvements:"];
    rubric.recommendations.forEach((item) => {
      lines.push(`- ${item}`);
    });
    if (rubric.flags?.missingMetrics) {
      lines.push("- Add a measurable metric (%, time saved, cost, risk reduction). ");
    }
    handleCopy(lines.join("\n"));
  };

  const downloadInterviewPack = async () => {
    setExportState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/export/interview-pack.docx?applicationId=${applicationId}&variant=${variant}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => ({}));
          setExportState({
            status: "error",
            message: payload?.error ?? "Export failed. Please try again.",
          });
        } else {
          setExportState({
            status: "error",
            message: "Export failed. Please try again.",
          });
        }
        return;
      }

      const blob = await response.blob();
      const filename = getFilenameFromDisposition(
        response.headers.get("content-disposition"),
        "cvforge-interview-pack.docx"
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportState({ status: "idle" });
    } catch (error) {
      console.error("[interview-pack.export]", error);
      setExportState({
        status: "error",
        message: "Export failed. Please try again.",
      });
    }
  };

  const metricHelper = useMemo(() => {
    if (!hasAchievements) {
      return "Add an achievement to apply metrics.";
    }
    return "Choose which achievement should receive the metric.";
  }, [hasAchievements]);

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

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Interview Pack
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Use these prompts to prepare answers grounded in your evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-[rgb(var(--ink))]">
              Variant
              <select
                value={variant}
                onChange={(event) =>
                  setVariant(event.target.value as ExportVariant)
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="ats_minimal">ATS-Minimal</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPracticeEnabled((prev) => !prev)}
              className={`h-10 rounded-full border px-4 text-xs font-semibold transition ${
                practiceEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
              aria-pressed={practiceEnabled}
            >
              Practice mode: {practiceEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={downloadInterviewPack}
            disabled={exportState.status === "loading"}
          >
            {exportState.status === "loading"
              ? "Preparing interview pack..."
              : "Export Interview Pack (DOCX)"}
          </Button>
        </div>
        {exportState.status === "error" && exportState.message ? (
          <p className="mt-2 text-xs text-red-600">{exportState.message}</p>
        ) : null}
        {practiceEnabled ? (
          <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs text-[rgb(var(--muted))]">
            Deterministic scoring — add metrics and outcomes for best results.
          </div>
        ) : null}
        {practiceLoading ? (
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            Loading practice answers...
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          Role Snapshot
        </p>
        {pack.roleSnapshot.length ? (
          <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--ink))]">
            {pack.roleSnapshot.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[rgb(var(--muted))]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[rgb(var(--muted))]">
            Add a richer job description to generate a role snapshot.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Top Questions
          </p>
          {hasAchievements ? (
            <div className="min-w-[220px]">
              <FormField label="Use achievement for STAR drafts">
                <select
                  value={selectedAchievementId}
                  onChange={(event) =>
                    setSelectedAchievementId(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {achievements.map((achievement) => (
                    <option key={achievement.id} value={achievement.id}>
                      {achievement.title}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          ) : null}
        </div>
        <div className="mt-4 space-y-4">
          {questionsWithKeys.map((question, index) => {
            const key = question.questionKey;
            const draft = drafts[key] ?? "";
            const score = practiceAnswers[key]?.score ?? null;
            const rubric = practiceAnswers[key]?.rubric_json ?? null;
            const breakdownOpen = Boolean(openBreakdowns[key]);
            const draftOpen = Boolean(openDrafts[key]);

            return (
              <div
                key={`${question.question}-${index}`}
                className="rounded-2xl border border-black/10 bg-white/80 p-3"
              >
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  {question.question}
                </p>
                {question.signals.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.signals.map((signal) => (
                      <span
                        key={signal}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
                  <pre className="whitespace-pre-wrap font-sans">
                    {question.starPrompt}
                  </pre>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCopy(question.starPrompt)}
                  >
                    Copy STAR prompt
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStarDraft}
                    disabled={!hasAchievements || pendingKey === "star-draft"}
                  >
                    {pendingKey === "star-draft"
                      ? "Creating..."
                      : "Create STAR draft"}
                  </Button>
                  {practiceEnabled ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDrafts((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                    >
                      {draftOpen ? "Hide practice" : "Practise"}
                    </button>
                  ) : null}
                </div>

                {practiceEnabled && draftOpen ? (
                  <div className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-white/70 p-3">
                    <label className="text-xs font-semibold text-[rgb(var(--muted))]">
                      Draft answer
                      <textarea
                        value={draft}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: event.target.value,
                          }))
                        }
                        rows={6}
                        className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                      <span>{draft.length} characters</span>
                      <Button
                        type="button"
                        onClick={() =>
                          handleScoreAnswer(key, question.question, question.signals)
                        }
                        disabled={pendingKey === `score-${key}`}
                      >
                        {pendingKey === `score-${key}`
                          ? "Scoring..."
                          : "Score answer"}
                      </Button>
                    </div>

                    {score !== null ? (
                      <div className="rounded-2xl border border-black/10 bg-white/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              score >= 80
                                ? "bg-emerald-100 text-emerald-700"
                                : score >= 60
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            Score: {score}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenBreakdowns((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                          >
                            {breakdownOpen ? "Hide breakdown" : "View breakdown"}
                          </button>
                        </div>
                        {breakdownOpen && rubric ? (
                          <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--muted))] sm:grid-cols-2">
                            <span>Situation: {rubric.breakdown.situation}/20</span>
                            <span>Task: {rubric.breakdown.task}/20</span>
                            <span>Action: {rubric.breakdown.action}/20</span>
                            <span>Result: {rubric.breakdown.result}/20</span>
                            <span>Metrics: {rubric.breakdown.metrics}/20</span>
                            <span>Relevance: {rubric.breakdown.relevance}/20</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {rubric?.recommendations?.length ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
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
                            onClick={() => handleCopyChecklist(key)}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                          >
                            Copy improved checklist
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Weak Spots
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">{metricHelper}</p>
        </div>
        {hasAchievements ? (
          <div className="mt-2 max-w-sm">
            <FormField label="Apply metrics to">
              <select
                value={selectedAchievementId}
                onChange={(event) =>
                  setSelectedAchievementId(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                {achievements.map((achievement) => (
                  <option key={achievement.id} value={achievement.id}>
                    {achievement.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {pack.weakSpots.map((spot) => (
            <div
              key={spot.id}
              className="rounded-2xl border border-black/10 bg-white/80 p-3"
            >
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {spot.label}
              </p>
              {spot.actionSuggestion ? (
                <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                  {spot.actionSuggestion}
                </p>
              ) : null}
              {spot.metricSuggestions.length ? (
                <div className="mt-2 space-y-2">
                  {spot.metricSuggestions.map((metric) => (
                    <div
                      key={metric}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-black/10 bg-white/70 px-3 py-2 text-xs text-[rgb(var(--muted))]"
                    >
                      <span>{metric}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(metric)}
                        className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleAddEvidence(spot)}
                  disabled={pendingKey === `evidence-${spot.id}`}
                >
                  {pendingKey === `evidence-${spot.id}`
                    ? "Adding..."
                    : "Add evidence"}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAddMetric(spot)}
                  disabled={!hasAchievements || pendingKey === `metric-${spot.id}`}
                >
                  {pendingKey === `metric-${spot.id}`
                    ? "Saving..."
                    : "Add metric"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          Prep Checklist
        </p>
        <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--muted))]">
          {pack.prepChecklist.map((item) => (
            <li key={item} className="flex gap-2">
              <span>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
