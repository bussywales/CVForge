"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WEEKLY_COACH_COPY, formatAlsoNeeded, formatCompleted } from "@/lib/copy/weekly-coach";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { WeeklyCoachAction, WeeklyCoachPlan } from "@/lib/weekly-coach";

type Props = {
  plan: WeeklyCoachPlan;
  weekKey: string;
};

export default function WeeklyCoachCard({ plan, weekKey }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [showList, setShowList] = useState(true);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const storageKey = useMemo(() => `weekly-coach-done:${plan.weekLabel}:${weekKey}`, [plan.weekLabel, weekKey]);
  useEffect(() => {
    const actionWithApp = plan.actions.find((action) => action.appId);
    if (actionWithApp?.appId) {
      logMonetisationClientEvent("weekly_coach_view", actionWithApp.appId, "insights", {
        week: plan.weekLabel,
      });
    }
  }, [plan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setDone(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const handleClick = (action: WeeklyCoachAction) => {
    if (action.appId) {
      logMonetisationClientEvent("weekly_coach_action_click", action.appId, "insights", {
        type: action.type,
      });
    }
  };

  const { primary, secondary, tertiary, extrasByType } = useMemo(() => {
    const seen = new Set<string>();
    const extras: Record<string, WeeklyCoachAction[]> = {};
    const uniques: WeeklyCoachAction[] = [];

    plan.actions.forEach((action) => {
      if (seen.has(action.type)) {
        extras[action.type] = extras[action.type] ?? [];
        extras[action.type]!.push(action);
        return;
      }
      seen.add(action.type);
      uniques.push(action);
    });

    return {
      primary: uniques.slice(0, 1),
      secondary: uniques.slice(1, 3),
      tertiary: uniques.slice(3, 5),
      extrasByType: extras,
    };
  }, [plan.actions]);

  const handleMarkDone = (action: WeeklyCoachAction) => {
    const key = actionSignature(action);
    const next = { ...done, [key]: true };
    setDone(next);
    persistDone(next);
    setSavedFlash(WEEKLY_COACH_COPY.ROW.SAVED);
    logMonetisationClientEvent("weekly_coach_mark_done", action.appId, "insights", {
      type: action.type,
    });
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const handleUndo = (action: WeeklyCoachAction) => {
    const key = actionSignature(action);
    const next = { ...done };
    delete next[key];
    setDone(next);
    persistDone(next);
    logMonetisationClientEvent("weekly_coach_undo", action.appId, "insights", {
      type: action.type,
    });
  };

  const persistDone = (state: Record<string, boolean>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  };

  const toggleExtras = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const goalCount = plan.actions.length;
  const doneCount = plan.actions.reduce(
    (acc, action) => (done[actionSignature(action)] ? acc + 1 : acc),
    0
  );
  const isWeekComplete = goalCount > 0 && doneCount >= goalCount;

  useEffect(() => {
    if (isWeekComplete && showList) {
      setShowList(false);
      logMonetisationClientEvent("weekly_coach_week_complete_view", primary[0]?.appId, "insights", {
        week: plan.weekLabel,
      });
    }
  }, [isWeekComplete, plan.weekLabel, primary, showList]);

  return (
    <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{plan.weekLabel}</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">
            Your next best actions to move applications forward
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {formatCompleted(WEEKLY_COACH_COPY.PROGRESS.COMPLETED_FMT, doneCount, goalCount)} ·{" "}
            {WEEKLY_COACH_COPY.PROGRESS.MOMENTUM}
          </p>
        </div>
        <GoalBadge count={goalCount} />
      </div>
      {savedFlash ? (
        <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {savedFlash}
        </div>
      ) : null}
      {isWeekComplete && !showList ? (
        <WeekComplete
          onAddOneMore={() => {
            setShowList(true);
            logMonetisationClientEvent("weekly_coach_add_one_more", primary[0]?.appId, "insights", {
              week: plan.weekLabel,
            });
          }}
          onLeave={() => {
            logMonetisationClientEvent("weekly_coach_leave_it", primary[0]?.appId, "insights", {
              week: plan.weekLabel,
            });
          }}
        />
      ) : (
        <div className="mt-5 space-y-4">
          <Section
            title={WEEKLY_COACH_COPY.SECTIONS.DO_NEXT}
            actions={primary}
            extrasByType={extrasByType}
            expanded={expanded}
            onToggle={toggleExtras}
            onClick={handleClick}
            done={done}
            onMarkDone={handleMarkDone}
            onUndo={handleUndo}
          />
          <Section
            title={WEEKLY_COACH_COPY.SECTIONS.UP_NEXT}
            actions={secondary}
            extrasByType={extrasByType}
            expanded={expanded}
            onToggle={toggleExtras}
            onClick={handleClick}
            done={done}
            onMarkDone={handleMarkDone}
            onUndo={handleUndo}
          />
          <Section
            title={WEEKLY_COACH_COPY.SECTIONS.IF_TIME}
            actions={tertiary}
            extrasByType={extrasByType}
            expanded={expanded}
            onToggle={toggleExtras}
            onClick={handleClick}
            done={done}
            onMarkDone={handleMarkDone}
            onUndo={handleUndo}
          />
          {isWeekComplete ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {WEEKLY_COACH_COPY.WEEK_COMPLETE.SUB}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
                  onClick={() => {
                    setShowList(false);
                  }}
                >
                  {WEEKLY_COACH_COPY.WEEK_COMPLETE.TITLE}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

type SectionProps = {
  title: string;
  actions: WeeklyCoachAction[];
  extrasByType: Record<string, WeeklyCoachAction[]>;
  expanded: Record<string, boolean>;
  onToggle: (type: string) => void;
  onClick: (action: WeeklyCoachAction) => void;
  done: Record<string, boolean>;
  onMarkDone: (action: WeeklyCoachAction) => void;
  onUndo: (action: WeeklyCoachAction) => void;
};

function Section({
  title,
  actions,
  extrasByType,
  expanded,
  onToggle,
  onClick,
  done,
  onMarkDone,
  onUndo,
}: SectionProps) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{title}</p>
      <div className="space-y-3">
        {actions.map((action) => {
          const extras = extrasByType[action.type] ?? [];
          const isOpen = expanded[action.type];
          const duplicateCount = extras.length;
          const signature = actionSignature(action);
          const isDone = Boolean(done[signature]);
          return (
            <div
              key={`${action.type}-${action.href}-${action.appId ?? "na"}`}
              className={`rounded-2xl border border-black/10 bg-white/80 px-4 py-3 shadow-sm ${isDone ? "opacity-80" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    {formatType(action.type)}
                  </p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{action.title}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">{action.why}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {WEEKLY_COACH_COPY.ROW.DONE}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                        aria-label={WEEKLY_COACH_COPY.ARIA.UNDO}
                        onClick={() => onUndo(action)}
                      >
                        {WEEKLY_COACH_COPY.ROW.UNDO}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))] shadow-sm hover:bg-slate-50"
                      aria-label={WEEKLY_COACH_COPY.ARIA.MARK_DONE}
                      onClick={() => onMarkDone(action)}
                    >
                      {WEEKLY_COACH_COPY.ROW.MARK_DONE}
                    </button>
                  )}
                  <Link
                    href={action.href}
                    onClick={() => onClick(action)}
                    className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
                  >
                    {ctaLabel(action.type, action.href)}
                  </Link>
                </div>
              </div>
              {duplicateCount > 0 ? (
                <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                  <button
                    type="button"
                    className="font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                    onClick={() => onToggle(action.type)}
                  >
                    {isOpen
                      ? WEEKLY_COACH_COPY.EXPANDER.HIDE
                      : formatAlsoNeeded(WEEKLY_COACH_COPY.EXPANDER.ALSO_NEEDED_FMT, duplicateCount)}
                  </button>
                  <p className="text-[11px] text-[rgb(var(--muted))]">{WEEKLY_COACH_COPY.EXPANDER.ALSO_HELPER}</p>
                </div>
              ) : null}
              {duplicateCount > 0 && isOpen ? (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  {extras.map((extra) => {
                    const extraSig = actionSignature(extra);
                    const extraDone = Boolean(done[extraSig]);
                    return (
                      <div
                        key={`${extra.href}-${extra.appId ?? "extra"}`}
                        className={`flex flex-wrap items-center justify-between gap-3 ${extraDone ? "opacity-80" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{extra.title}</p>
                          <p className="text-xs text-[rgb(var(--muted))]">{extra.why}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {extraDone ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                {WEEKLY_COACH_COPY.ROW.DONE}
                              </span>
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                                onClick={() => onUndo(extra)}
                                aria-label={WEEKLY_COACH_COPY.ARIA.UNDO}
                              >
                                {WEEKLY_COACH_COPY.ROW.UNDO}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[rgb(var(--ink))] shadow-sm hover:bg-slate-50"
                              onClick={() => onMarkDone(extra)}
                              aria-label={WEEKLY_COACH_COPY.ARIA.MARK_DONE}
                            >
                              {WEEKLY_COACH_COPY.ROW.MARK_DONE}
                            </button>
                          )}
                          <Link
                            href={extra.href}
                            onClick={() => onClick(extra)}
                            className="rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
                          >
                            {ctaLabel(extra.type, extra.href)}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatType(type: WeeklyCoachAction["type"]) {
  return type.replace("_", " ");
}

function ctaLabel(type: WeeklyCoachAction["type"], href: string) {
  if (type === "evidence") return "Select evidence";
  if (type === "star") return "Draft STAR";
  if (type === "autopack") return "Generate Autopack";
  if (type === "answer_pack" || type === "interview_pack") return "Start practice";
  if (type === "followup") return href.includes("followup") ? "Schedule follow-up" : "Send follow-up";
  if (type === "jobtext") return "Add job text";
  if (type === "billing") return "Review billing";
  return "Open";
}

function GoalBadge({ count }: { count: number }) {
  return (
    <div className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[rgb(var(--ink))] shadow-sm">
      Goal: {count} action{count === 1 ? "" : "s"}
    </div>
  );
}

function actionSignature(action: WeeklyCoachAction) {
  return `${action.type}:${action.appId ?? action.href}`;
}

type WeekCompleteProps = {
  onAddOneMore: () => void;
  onLeave: () => void;
};

function WeekComplete({ onAddOneMore, onLeave }: WeekCompleteProps) {
  return (
    <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-[rgb(var(--ink))] shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">{WEEKLY_COACH_COPY.WEEK_COMPLETE.TITLE}</p>
      <p className="mt-1 text-lg font-semibold text-emerald-900">{WEEKLY_COACH_COPY.WEEK_COMPLETE.SUB}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
          onClick={onAddOneMore}
        >
          {WEEKLY_COACH_COPY.WEEK_COMPLETE.ADD_ONE_MORE}
        </button>
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] shadow-sm hover:bg-slate-50"
          onClick={onLeave}
        >
          {WEEKLY_COACH_COPY.WEEK_COMPLETE.LEAVE_IT}
        </button>
      </div>
    </div>
  );
}
