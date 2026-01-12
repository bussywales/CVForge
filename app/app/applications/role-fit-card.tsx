"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Section from "@/components/Section";
import type { RoleFitResult } from "@/lib/role-fit";

type RoleFitCardProps = {
  result: RoleFitResult;
  hasJobDescription: boolean;
  hasEvidence: boolean;
  achievements: Array<{
    id: string;
    title: string;
    metrics: string | null;
  }>;
};

export default function RoleFitCard({
  result,
  hasJobDescription,
  hasEvidence,
  achievements,
}: RoleFitCardProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{
    message: string;
    href?: string;
    actionLabel?: string;
  } | null>(null);
  const [openGapId, setOpenGapId] = useState<string | null>(null);
  const [pendingGapId, setPendingGapId] = useState<string | null>(null);
  const [pendingAchievementId, setPendingAchievementId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const guidance = !hasJobDescription
    ? "Add a job description to get a role-fit score."
    : result.availableCount === 0
      ? "Add more detail or paste the person spec to surface role-fit signals."
    : !hasEvidence
      ? "Add achievements or a profile headline to improve your score."
      : null;

  const coverageLabel = useMemo(() => {
    if (!hasJobDescription || result.availableCount === 0) {
      return "Coverage: 0 / 0 signals (0%)";
    }
    return `Coverage: ${result.matchedCount} / ${result.availableCount} signals (${result.coveragePct}%)`;
  }, [
    hasJobDescription,
    result.availableCount,
    result.coveragePct,
    result.matchedCount,
  ]);

  const packLabel = useMemo(() => {
    const base = result.appliedPacks.map((pack) => pack.label).join(" + ");
    return result.fallbackUsed ? `${base} + JD terms` : base;
  }, [result.appliedPacks, result.fallbackUsed]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied." });
    } catch (error) {
      console.error("[role-fit.copy]", error);
      setToast({ message: "Unable to copy right now." });
    }
  };

  const handleAddAchievement = async (gap: RoleFitResult["gapSignals"][number]) => {
    if (!gap.primaryAction) {
      return;
    }
    setPendingGapId(gap.id);
    try {
      const response = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: gap.label,
          action: gap.primaryAction,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to add the achievement right now.",
        });
        return;
      }
      setToast({
        message: "Achievement added.",
        href: "/app/profile#achievements",
        actionLabel: "Open achievements",
      });
      setOpenGapId(null);
      router.refresh();
    } catch (error) {
      console.error("[role-fit.add-achievement]", error);
      setToast({ message: "Unable to add the achievement right now." });
    } finally {
      setPendingGapId(null);
    }
  };

  const handleInsert = async (
    gap: RoleFitResult["gapSignals"][number],
    achievementId: string
  ) => {
    const clause = formatClause(gap.shortAction || gap.primaryAction);
    if (!clause) {
      setToast({ message: "Nothing to insert for this gap." });
      return;
    }
    setPendingAchievementId(achievementId);
    try {
      const response = await fetch(`/api/achievements/${achievementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clause }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to update the achievement right now.",
        });
        return;
      }
      setToast({ message: "Inserted into achievement." });
      setOpenGapId(null);
      router.refresh();
    } catch (error) {
      console.error("[role-fit.insert-achievement]", error);
      setToast({ message: "Unable to update the achievement right now." });
    } finally {
      setPendingAchievementId(null);
    }
  };

  return (
    <Section
      title="Role fit"
      description="How closely your evidence matches the job description."
    >
      <div className="space-y-4">
        {toast ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <span>{toast.message}</span>
            <div className="flex items-center gap-3">
              {toast.href ? (
                <Link
                  href={toast.href}
                  className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                >
                  {toast.actionLabel ?? "Open"}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-full border border-emerald-200 bg-white/70 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition hover:bg-white"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/70 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Role fit score
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[rgb(var(--ink))]">
                {result.score}
              </span>
              <span className="text-sm text-[rgb(var(--muted))]">/ 100</span>
            </div>
            <div className="mt-1 space-y-1 text-xs text-[rgb(var(--muted))]">
              <p>{coverageLabel}</p>
              {packLabel ? <p>Using: {packLabel}</p> : null}
            </div>
          </div>
          <p className="max-w-xs text-xs text-[rgb(var(--muted))]">
            Heuristic score — improve by adding evidence in Achievements.
          </p>
        </div>

        {guidance ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
            {guidance}
          </div>
        ) : null}

        {hasJobDescription && result.availableCount > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Matched signals
              </p>
              {result.matchedSignals.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.matchedSignals.map((signal) => (
                    <span
                      key={signal.id}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        signal.source === "fallback"
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {signal.label}
                      {signal.source === "fallback" ? " · JD term" : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No matched signals yet. Add evidence in Achievements.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Gaps to strengthen
              </p>
              {result.gapSignals.length ? (
                <div className="mt-3 space-y-4 text-sm text-[rgb(var(--ink))]">
                  {result.gapSignals.map((gap) => (
                    <div
                      key={gap.id}
                      className="space-y-3 rounded-2xl border border-black/5 bg-white/70 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                            aria-hidden
                          />
                          <span className="font-semibold">
                            {gap.label}
                            {gap.source === "fallback" ? " · JD term" : ""}
                          </span>
                        </div>
                        {gap.allowActions ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => handleAddAchievement(gap)}
                              disabled={pendingGapId === gap.id}
                            >
                              {pendingGapId === gap.id
                                ? "Adding..."
                                : "Add as achievement"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setOpenGapId((current) =>
                                  current === gap.id ? null : gap.id
                                )
                              }
                            >
                              Insert into action…
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 text-xs text-[rgb(var(--muted))]">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                            Suggested achievement action
                          </p>
                          <ul className="mt-2 space-y-1">
                            {gap.actionSuggestions.map((suggestion) => (
                              <li
                                key={suggestion}
                                className="flex flex-wrap items-start justify-between gap-2"
                              >
                                <span className="flex-1 text-xs text-[rgb(var(--muted))]">
                                  {suggestion}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(suggestion)}
                                  className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                                >
                                  Copy
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                            Suggested metrics (≤120 chars)
                          </p>
                          <ul className="mt-2 space-y-1">
                            {gap.metricSuggestions.map((metric) => (
                              <li
                                key={metric}
                                className="flex flex-wrap items-start justify-between gap-2"
                              >
                                <span className="flex-1 text-xs text-[rgb(var(--muted))]">
                                  {metric}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(metric)}
                                  className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                                >
                                  Copy
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {gap.allowActions && openGapId === gap.id ? (
                        <div className="rounded-2xl border border-black/10 bg-white/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                            Insert into achievement
                          </p>
                          {achievements.length ? (
                            <div className="mt-3 space-y-2">
                              {achievements.map((achievement) => (
                                <button
                                  key={achievement.id}
                                  type="button"
                                  onClick={() =>
                                    handleInsert(gap, achievement.id)
                                  }
                                  disabled={
                                    pendingAchievementId === achievement.id
                                  }
                                  className="w-full rounded-2xl border border-black/10 bg-white/70 p-3 text-left text-sm transition hover:border-black/20"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[rgb(var(--ink))]">
                                      {achievement.title}
                                    </span>
                                    {pendingAchievementId === achievement.id ? (
                                      <span className="text-xs text-[rgb(var(--muted))]">
                                        Updating…
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                                    {achievement.metrics
                                      ? achievement.metrics.slice(0, 80)
                                      : "No metrics yet"}
                                  </p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-[rgb(var(--muted))]">
                              No achievements yet. Add one first.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No gaps detected yet. Add more detail if needed.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function formatClause(value: string) {
  const trimmed = value.trim().replace(/[.;:,]+$/g, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return trimmed.slice(0, 120).replace(/[.;:,]+$/g, "").trim();
}
