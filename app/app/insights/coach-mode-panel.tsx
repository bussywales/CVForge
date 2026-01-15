"use client";

import Link from "next/link";
import type { CoachAction, WeakestStep, WeeklyTargets } from "@/lib/coach-mode";

type Props = {
  weeklyTargets: WeeklyTargets;
  weakest: WeakestStep;
  coachActions: CoachAction[];
  coachMessage?: string | null;
};

function TargetCard({
  title,
  current,
  target,
  hint,
}: {
  title: string;
  current: number;
  target: number;
  hint: string;
}) {
  const tone =
    current >= target
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[rgb(var(--ink))]">
        {current} / {target}
      </p>
      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${tone}`}>
        {current >= target ? "Done" : "In progress"}
      </span>
      <p className="mt-2 text-xs text-[rgb(var(--muted))]">{hint}</p>
    </div>
  );
}

export default function CoachModePanel({
  weeklyTargets,
  weakest,
  coachActions,
  coachMessage,
}: Props) {
  return (
    <div className="space-y-4 rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Coach Mode
          </p>
          <p className="text-sm text-[rgb(var(--muted))]">Reset each week (Mon–Sun)</p>
        </div>
        {coachMessage ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {coachMessage.replace("_", " ")}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <TargetCard
          title="Follow-ups"
          current={weeklyTargets.followups.current}
          target={weeklyTargets.followups.target}
          hint={weeklyTargets.followups.hint}
        />
        <TargetCard
          title="Submissions"
          current={weeklyTargets.submissions.current}
          target={weeklyTargets.submissions.target}
          hint={weeklyTargets.submissions.hint}
        />
        <TargetCard
          title="STAR drafts"
          current={weeklyTargets.starDrafts.current}
          target={weeklyTargets.starDrafts.target}
          hint={weeklyTargets.starDrafts.hint}
        />
        {weeklyTargets.practice ? (
          <TargetCard
            title="Practice drills"
            current={weeklyTargets.practice.current}
            target={weeklyTargets.practice.target}
            hint={weeklyTargets.practice.hint}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-xs text-[rgb(var(--muted))]">
            Practice drills will appear after you save interview answers.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {weakest.title}
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">{weakest.detail}</p>
          </div>
          <Link
            href={weakest.href}
            className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Fix this now
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">
          Coach actions
        </p>
        {coachActions.length === 0 ? (
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            All caught up. Keep logging outcomes and follow-ups.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {coachActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
