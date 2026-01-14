"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Section from "@/components/Section";
import type { RoleFitResult } from "@/lib/role-fit";
import { normalizeSelectedEvidence } from "@/lib/evidence";
import { buildMetricSnippet } from "@/lib/metrics-helper";

type RoleFitCardProps = {
  applicationId: string;
  result: RoleFitResult;
  hasJobDescription: boolean;
  hasEvidence: boolean;
  achievements: Array<{
    id: string;
    title: string;
    metrics: string | null;
  }>;
  selectedEvidence?: unknown;
};

export default function RoleFitCard({
  applicationId,
  result,
  hasJobDescription,
  hasEvidence,
  achievements,
  selectedEvidence,
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
  const [pendingEvidenceId, setPendingEvidenceId] = useState<string | null>(
    null
  );
  const [evidenceByGap, setEvidenceByGap] = useState<
    Record<string, EvidenceSuggestion[]>
  >({});
  const [evidenceStatus, setEvidenceStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

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

  const selectedEvidenceList = useMemo(
    () => normalizeSelectedEvidence(selectedEvidence),
    [selectedEvidence]
  );

  const selectedEvidenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    selectedEvidenceList.forEach((entry) => {
      counts.set(entry.signalId, (counts.get(entry.signalId) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([signalId, count]) => ({
      signalId,
      count,
    }));
  }, [selectedEvidenceList]);

  const evidenceCoverageLabel = useMemo(() => {
    const total = result.gapSignals.length;
    if (!hasJobDescription || total === 0) {
      return "Evidence matches: 0 / 0 gaps";
    }
    const selectedSignals = new Set(
      selectedEvidenceList.map((entry) => entry.signalId)
    );
    const matched = result.gapSignals.reduce((count, gap) => {
      if (selectedSignals.has(gap.id)) {
        return count + 1;
      }
      const suggestions = evidenceByGap[gap.id] ?? [];
      if (suggestions.some((item) => item.matchScore >= 0.6)) {
        return count + 1;
      }
      return count;
    }, 0);
    return `Evidence matches: ${matched} / ${total} gaps`;
  }, [evidenceByGap, hasJobDescription, result.gapSignals, selectedEvidenceList]);

  const signalLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    result.matchedSignals.forEach((signal) => {
      map.set(signal.id, signal.label);
    });
    result.gapSignals.forEach((signal) => {
      map.set(signal.id, signal.label);
    });
    return map;
  }, [result.gapSignals, result.matchedSignals]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: "Copied." });
    } catch (error) {
      console.error("[role-fit.copy]", error);
      setToast({ message: "Unable to copy right now." });
    }
  };

  const fetchEvidenceSuggestions = useCallback(async () => {
    if (!applicationId || !hasJobDescription || result.gapSignals.length === 0) {
      return;
    }
    setEvidenceStatus("loading");
    try {
      const response = await fetch(
        `/api/evidence/suggest?applicationId=${applicationId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEvidenceStatus("error");
        setToast({
          message: payload?.error ?? "Unable to load evidence suggestions.",
        });
        return;
      }
      const gapMap: Record<string, EvidenceSuggestion[]> = {};
      (payload?.gaps ?? []).forEach((gap: EvidenceGapSuggestion) => {
        gapMap[gap.signalId] = gap.suggestedEvidence ?? [];
      });
      setEvidenceByGap(gapMap);
      setEvidenceStatus("idle");
    } catch (error) {
      console.error("[role-fit.evidence]", error);
      setEvidenceStatus("error");
      setToast({ message: "Unable to load evidence suggestions." });
    }
  }, [applicationId, hasJobDescription, result.gapSignals.length]);

  useEffect(() => {
    void fetchEvidenceSuggestions();
  }, [fetchEvidenceSuggestions]);

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

  const handleCreateFallbackAchievement = async (
    gap: RoleFitResult["gapSignals"][number]
  ) => {
    const action = gap.primaryAction || gap.actionSuggestions[0];
    const metric = buildFallbackMetricSnippet(
      gap.label,
      gap.metricSuggestions[0] ?? ""
    );
    if (!action) {
      return;
    }
    setPendingGapId(gap.id);
    try {
      const response = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `Evidence for ${gap.label}`,
          action,
          metrics: metric,
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
      console.error("[role-fit.add-fallback]", error);
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

  const handleEvidenceSelect = async (
    evidenceId: string,
    signalId: string
  ) => {
    setPendingEvidenceId(evidenceId);
    try {
      const response = await fetch("/api/evidence/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ applicationId, evidenceId, signalId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to select evidence right now.",
        });
        return;
      }
      setToast({ message: "Evidence selected." });
      router.refresh();
    } catch (error) {
      console.error("[role-fit.select]", error);
      setToast({ message: "Unable to select evidence right now." });
    } finally {
      setPendingEvidenceId(null);
    }
  };

  const handleEvidenceApply = async (
    mode: EvidenceApplyMode,
    evidenceId: string,
    signalId: string
  ) => {
    setPendingEvidenceId(evidenceId);
    try {
      const response = await fetch("/api/evidence/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ applicationId, evidenceId, signalId, mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to apply evidence right now.",
        });
        return;
      }
      setToast({
        message:
          mode === "create_draft_achievement"
            ? "Draft achievement created."
            : mode === "attach_to_star"
              ? "Evidence added to STAR draft."
              : "Metrics updated.",
      });
      router.refresh();
    } catch (error) {
      console.error("[role-fit.apply]", error);
      setToast({ message: "Unable to apply evidence right now." });
    } finally {
      setPendingEvidenceId(null);
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
              <p>{evidenceCoverageLabel}</p>
              {packLabel ? <p>Using: {packLabel}</p> : null}
            </div>
          </div>
          <p className="max-w-xs text-xs text-[rgb(var(--muted))]">
            Heuristic score — improve by adding evidence in Achievements.
          </p>
        </div>

        {selectedEvidenceCounts.length ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Selected evidence
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedEvidenceCounts.map(({ signalId, count }) => (
                <span
                  key={signalId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {signalLabelMap.get(signalId) ?? signalId} · {count}
                </span>
              ))}
            </div>
          </div>
        ) : null}

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
                        ) : gap.source === "fallback" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                handleCreateFallbackAchievement(gap)
                              }
                              disabled={pendingGapId === gap.id}
                            >
                              {pendingGapId === gap.id
                                ? "Adding..."
                                : "Create draft evidence"}
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

                        {gap.allowActions ? (
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                              Suggested evidence
                            </p>
                            {evidenceStatus === "loading" ? (
                              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                                Loading evidence suggestions...
                              </p>
                            ) : evidenceByGap[gap.id]?.length ? (
                              <ul className="mt-2 space-y-2">
                                {evidenceByGap[gap.id].map((item) => (
                                  <li
                                    key={item.id}
                                    className="rounded-xl border border-black/10 bg-white/70 p-2"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-[rgb(var(--ink))]">
                                        {item.title}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                          {item.kind === "work_bullet"
                                            ? "Work history"
                                            : "Achievement"}
                                        </span>
                                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                          Quality {item.qualityScore}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                                      {item.shortSnippet}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEvidenceSelect(item.id, gap.id)
                                        }
                                        className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                                        disabled={pendingEvidenceId === item.id}
                                      >
                                        Select
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(item.shortSnippet)}
                                        className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                                      >
                                        Copy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEvidenceApply(
                                            "attach_to_star",
                                            item.id,
                                            gap.id
                                          )
                                        }
                                        className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                                        disabled={pendingEvidenceId === item.id}
                                      >
                                        Add to STAR
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-2 space-y-2 text-xs text-[rgb(var(--muted))]">
                                <p>
                                  No confident matches yet. Create a draft or insert a clause to add evidence for{" "}
                                  {gap.label}.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleCreateFallbackAchievement(gap)}
                                    disabled={pendingGapId === gap.id}
                                  >
                                    {pendingGapId === gap.id
                                      ? "Adding..."
                                      : "Create draft evidence"}
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
                                    Insert clause into action…
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {openGapId === gap.id ? (
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

function buildFallbackMetricSnippet(label: string, fallback: string) {
  const metric = pickMetricHint(label);
  const snippet = buildMetricSnippet("percent-improvement", {
    metric,
    percent: "X",
    period: "3 months",
  });
  if (snippet && snippet.length <= 120) {
    return snippet;
  }
  return fallback;
}

function pickMetricHint(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("incident")) {
    return "incident resolution time";
  }
  if (lower.includes("sla") || lower.includes("service")) {
    return "SLA compliance";
  }
  if (lower.includes("document") || lower.includes("standard")) {
    return "onboarding time";
  }
  if (lower.includes("change")) {
    return "change turnaround time";
  }
  return "delivery time";
}

type EvidenceSuggestion = {
  id: string;
  kind: "achievement" | "work_bullet";
  title: string;
  text: string;
  shortSnippet: string;
  matchScore: number;
  qualityScore: number;
  sourceType?: string;
  sourceId?: string;
};

type EvidenceGapSuggestion = {
  signalId: string;
  label: string;
  suggestedEvidence: EvidenceSuggestion[];
};

type EvidenceApplyMode =
  | "create_draft_achievement"
  | "insert_clause_metric"
  | "attach_to_star";
