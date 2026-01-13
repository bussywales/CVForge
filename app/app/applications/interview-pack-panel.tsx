"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { InterviewPack, InterviewPackWeakSpot } from "@/lib/interview-pack";
import type { ExportVariant } from "@/lib/export/export-utils";

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
          <label className="text-sm font-medium text-[rgb(var(--ink))]">
            Variant
            <select
              value={variant}
              onChange={(event) => setVariant(event.target.value as ExportVariant)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="ats_minimal">ATS-Minimal</option>
            </select>
          </label>
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
                  onChange={(event) => setSelectedAchievementId(event.target.value)}
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
          {pack.questions.map((question, index) => (
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
              </div>
            </div>
          ))}
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
                onChange={(event) => setSelectedAchievementId(event.target.value)}
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
