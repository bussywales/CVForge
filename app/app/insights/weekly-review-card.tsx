"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { WEEKLY_COACH_COPY, formatCompleted } from "@/lib/copy/weekly-coach";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { getIsoWeekKey } from "@/lib/weekly-review";

type Props = {
  weekKey: string;
  summary: {
    applicationsMoved: number;
    followupsSent: number;
    outcomesLogged: number;
  };
};

export default function WeeklyReviewCard({ weekKey, summary }: Props) {
  useEffect(() => {
    logMonetisationClientEvent("weekly_review_view", null, "insights", { week: weekKey });
  }, [weekKey]);

  const doneThisWeek = useMemo(() => {
    if (typeof window === "undefined") return 0;
    try {
      const key = `weekly-coach-done:${weekKey}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return Object.values(parsed).filter(Boolean).length;
    } catch {
      return 0;
    }
  }, [weekKey]);

  const showOutcomePrompt = summary.outcomesLogged === 0 && (summary.followupsSent > 0 || summary.applicationsMoved > 0);

  return (
    <SectionShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{WEEKLY_COACH_COPY.PROGRESS.THIS_WEEK}</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">Weekly review</p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {formatCompleted(WEEKLY_COACH_COPY.PROGRESS.COMPLETED_FMT, doneThisWeek, Math.max(doneThisWeek, 5))} ·{" "}
            {WEEKLY_COACH_COPY.PROGRESS.MOMENTUM}
          </p>
        </div>
        <StreakBadge />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: "Actions completed", value: doneThisWeek },
          { label: "Applications moved forward", value: summary.applicationsMoved },
          { label: "Follow-ups sent", value: summary.followupsSent },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[rgb(var(--ink))]">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Outcomes logged</p>
        <p className="mt-1 text-2xl font-semibold text-[rgb(var(--ink))]">{summary.outcomesLogged}</p>
        {showOutcomePrompt ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[rgb(var(--muted))]">Close the loop by logging outcomes.</span>
            <Link
              href="/app/pipeline"
              className="rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
              onClick={() => logMonetisationClientEvent("weekly_review_log_outcomes_click", null, "insights", { week: weekKey })}
            >
              Log outcomes
            </Link>
            <button
              type="button"
              className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
              onClick={() => logMonetisationClientEvent("weekly_review_not_now", null, "insights", { week: weekKey })}
            >
              Not now
            </button>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm">{children}</div>;
}

function StreakBadge() {
  const { label } = useMemo(() => {
    if (typeof window === "undefined") return { label: "Start your streak this week" };
    try {
      const now = new Date();
      const currentKey = getIsoWeekKey(now);
      const raw = window.localStorage.getItem("weekly-coach-streak");
      const parsed = raw ? (JSON.parse(raw) as { key: string; streak: number }) : null;
      const streak = parsed?.key === currentKey ? parsed.streak : 0;
      if (streak <= 0) return { label: "Start your streak this week" };
      return { label: `Streak: ${streak} week${streak === 1 ? "" : "s"}` };
    } catch {
      return { label: "Start your streak this week" };
    }
  }, []);

  useEffect(() => {
    logMonetisationClientEvent("weekly_streak_view", null, "insights");
  }, []);

  return (
    <div className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[rgb(var(--ink))] shadow-sm">
      {label}
    </div>
  );
}
