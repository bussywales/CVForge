"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { InterviewLiftResult } from "@/lib/interview-lift";
import type { RoleFitSignalGap } from "@/lib/role-fit";
import MetricsHelperModal from "@/app/app/profile/metrics-helper-modal";

type InterviewLiftPanelProps = {
  applicationId: string;
  result: InterviewLiftResult;
  achievements: Array<{ id: string; title: string; metrics: string | null }>;
  showTitle?: boolean;
  compact?: boolean;
  onActionComplete?: () => void;
};

type ToastState = { message: string; variant?: "success" | "error" };

export default function InterviewLiftPanel({
  applicationId,
  result,
  achievements,
  showTitle = true,
  compact = false,
  onActionComplete,
}: InterviewLiftPanelProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [metricsHelperOpen, setMetricsHelperOpen] = useState(false);
  const [selectedAchievementId, setSelectedAchievementId] = useState(
    achievements[0]?.id ?? ""
  );
  const [starAchievementId, setStarAchievementId] = useState(
    achievements[0]?.id ?? ""
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (achievements.length) {
      setSelectedAchievementId((prev) => prev || achievements[0].id);
      setStarAchievementId((prev) => prev || achievements[0].id);
    }
  }, [achievements]);

  const evidenceAction = result.actions.find(
    (action) => action.id === "add_evidence"
  );
  const metricAction = result.actions.find(
    (action) => action.id === "add_metric"
  );

  const actionSuggestion = evidenceAction?.actionSuggestion?.trim() ?? "";
  const gapLabel = evidenceAction?.gap?.label ?? evidenceAction?.fallbackTerm ?? "";
  const allowEvidenceActions = evidenceAction?.gap?.allowActions ?? false;

  const initialTemplateId = useMemo(
    () => pickMetricTemplateId(metricAction?.gap),
    [metricAction]
  );

  const cadenceLabel = useMemo(() => {
    switch (result.cadenceStatus) {
      case "ok":
        return "On track";
      case "due":
        return "Due today";
      case "overdue":
        return "Overdue";
      default:
        return "Not set";
    }
  }, [result.cadenceStatus]);

  const metricsSuggestions = metricAction?.metricSuggestions ?? [];

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied.", variant: "success" });
    } catch (error) {
      console.error("[interview-lift.copy]", error);
      setToast({ message: "Unable to copy right now.", variant: "error" });
    }
  };

  const markLiftAction = async (action: "add_evidence" | "add_metric") => {
    await fetch(`/api/applications/${applicationId}/lift-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  };

  const handleAddEvidence = async () => {
    const title = gapLabel
      ? allowEvidenceActions
        ? gapLabel
        : `Evidence for ${gapLabel}`
      : "Role evidence";
    const action = actionSuggestion ||
      (gapLabel ? `Delivered outcomes aligned to ${gapLabel}.` : "Delivered role-aligned outcomes.");

    startTransition(async () => {
      try {
        const response = await fetch("/api/achievements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title,
            action,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setToast({
            message: payload?.error ?? "Unable to add achievement right now.",
            variant: "error",
          });
          return;
        }
        await markLiftAction("add_evidence");
        setToast({ message: "Evidence line added.", variant: "success" });
        router.refresh();
        onActionComplete?.();
      } catch (error) {
        console.error("[interview-lift.add-evidence]", error);
        setToast({ message: "Unable to add achievement right now.", variant: "error" });
      }
    });
  };

  const handleApplyMetric = async (value: string) => {
    if (!selectedAchievementId) {
      setToast({ message: "Choose an achievement first.", variant: "error" });
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/achievements/${selectedAchievementId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ metrics: value }),
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setToast({
            message: payload?.error ?? "Unable to update metrics right now.",
            variant: "error",
          });
          return;
        }
        await markLiftAction("add_metric");
        setToast({ message: "Metric added.", variant: "success" });
        router.refresh();
        onActionComplete?.();
      } catch (error) {
        console.error("[interview-lift.add-metric]", error);
        setToast({ message: "Unable to update metrics right now.", variant: "error" });
      }
    });
  };

  const handleStarDraft = async () => {
    if (!starAchievementId) {
      setToast({ message: "Choose an achievement first.", variant: "error" });
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/star-draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ achievementId: starAchievementId }),
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
        onActionComplete?.();
      } catch (error) {
        console.error("[interview-lift.star-draft]", error);
        setToast({ message: "Unable to draft STAR answer right now.", variant: "error" });
      }
    });
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {showTitle ? (
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Interview Lift
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            Focus on the next actions most likely to improve interview outcomes.
          </p>
        </div>
      ) : null}

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
              Interview Lift score
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[rgb(var(--ink))]">
                {result.score}
              </span>
              <span className="text-sm text-[rgb(var(--muted))]">/ 100</span>
            </div>
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">
            <p>Role fit coverage: {result.roleFitCoverage}%</p>
            <p>Metrics coverage: {result.metricsCoverage}%</p>
            <p>Cadence: {cadenceLabel}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Add role evidence
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                {evidenceAction?.description ?? "Add a line that maps to the role."}
              </p>
            </div>
            <Button type="button" onClick={handleAddEvidence} disabled={isPending}>
              {isPending ? "Adding..." : "Add evidence"}
            </Button>
          </div>
          {actionSuggestion ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs">
              <span className="flex-1 text-[rgb(var(--muted))]">
                {actionSuggestion}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(actionSuggestion)}
                className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]"
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Add a metric
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                {metricAction?.description ?? "Add a measurable impact line."}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMetricsHelperOpen(true)}
              disabled={isPending || achievements.length === 0}
            >
              Open metrics helper
            </Button>
          </div>

          {metricsSuggestions.length ? (
            <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
              {metricsSuggestions.map((metric) => (
                <div
                  key={metric}
                  className="flex flex-wrap items-start justify-between gap-2"
                >
                  <span className="flex-1">{metric}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(metric)}
                    className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            <FormField label="Apply metric to" htmlFor="metric-achievement">
              <select
                id="metric-achievement"
                value={selectedAchievementId}
                onChange={(event) => setSelectedAchievementId(event.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                disabled={achievements.length === 0}
              >
                {achievements.length === 0 ? (
                  <option value="">Add an achievement first</option>
                ) : (
                  achievements.map((achievement) => (
                    <option key={achievement.id} value={achievement.id}>
                      {achievement.title}
                    </option>
                  ))
                )}
              </select>
            </FormField>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Draft a STAR answer
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                {result.actions.find((action) => action.id === "draft_star")?.description ??
                  "Turn an achievement into a STAR draft."}
              </p>
            </div>
            <Button type="button" onClick={handleStarDraft} disabled={isPending}>
              {isPending ? "Drafting..." : "Draft STAR"}
            </Button>
          </div>
          <div className="mt-3">
            <FormField label="Use achievement" htmlFor="star-achievement">
              <select
                id="star-achievement"
                value={starAchievementId}
                onChange={(event) => setStarAchievementId(event.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                disabled={achievements.length === 0}
              >
                {achievements.length === 0 ? (
                  <option value="">Add an achievement first</option>
                ) : (
                  achievements.map((achievement) => (
                    <option key={achievement.id} value={achievement.id}>
                      {achievement.title}
                    </option>
                  ))
                )}
              </select>
            </FormField>
          </div>
        </div>
      </div>

      <MetricsHelperModal
        isOpen={metricsHelperOpen}
        initialTemplateId={initialTemplateId}
        onClose={() => setMetricsHelperOpen(false)}
        onApply={(value) => {
          setMetricsHelperOpen(false);
          handleApplyMetric(value);
        }}
      />
    </div>
  );
}

function pickMetricTemplateId(gap?: RoleFitSignalGap): string {
  const label = gap?.label.toLowerCase() ?? "";
  if (label.includes("sla")) {
    return "sla-improvement";
  }
  if (label.includes("cost")) {
    return "cost-reduction";
  }
  if (label.includes("time") || label.includes("response")) {
    return "time-saved";
  }
  if (label.includes("volume") || label.includes("ticket")) {
    return "volume-handled";
  }
  return "percent-improvement";
}
