"use client";

import Link from "next/link";
import { useEffect } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { WeeklyCoachAction, WeeklyCoachPlan } from "@/lib/weekly-coach";

type Props = {
  plan: WeeklyCoachPlan;
};

export default function WeeklyCoachCard({ plan }: Props) {
  useEffect(() => {
    const actionWithApp = plan.actions.find((action) => action.appId);
    if (actionWithApp?.appId) {
      logMonetisationClientEvent("weekly_coach_view", actionWithApp.appId, "insights", {
        week: plan.weekLabel,
      });
    }
  }, [plan]);

  const handleClick = (action: WeeklyCoachAction) => {
    if (action.appId) {
      logMonetisationClientEvent("weekly_coach_action_click", action.appId, "insights", {
        type: action.type,
      });
    }
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{plan.weekLabel}</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">{plan.headline}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs md:text-sm">
          <TargetPill label="Follow-ups" value={plan.targets.followUps} />
          <TargetPill label="Practice" value={plan.targets.practice} />
          <TargetPill label="Applications" value={plan.targets.applications} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {plan.actions.map((action) => (
          <div
            key={`${action.type}-${action.href}-${action.appId ?? "na"}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                {formatType(action.type)}
              </p>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">{action.title}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{action.why}</p>
            </div>
            <Link
              href={action.href}
              onClick={() => handleClick(action)}
              className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
            >
              Do it
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatType(type: WeeklyCoachAction["type"]) {
  return type.replace("_", " ");
}

function TargetPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-center shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[rgb(var(--muted))]">{label}</p>
      <p className="text-base font-semibold text-[rgb(var(--ink))]">{value}</p>
    </div>
  );
}
