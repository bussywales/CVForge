"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { WeeklyCoachAction, WeeklyCoachPlan } from "@/lib/weekly-coach";

type Props = {
  plan: WeeklyCoachPlan;
};

export default function WeeklyCoachCard({ plan }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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

  const toggleExtras = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const goalCount = plan.actions.length;

  return (
    <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{plan.weekLabel}</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">
            Your next best actions to move applications forward
          </p>
        </div>
        <GoalBadge count={goalCount} />
      </div>
      <div className="mt-5 space-y-4">
        <Section title="Do next" actions={primary} extrasByType={extrasByType} expanded={expanded} onToggle={toggleExtras} onClick={handleClick} />
        <Section title="Up next" actions={secondary} extrasByType={extrasByType} expanded={expanded} onToggle={toggleExtras} onClick={handleClick} />
        <Section title="If you have time" actions={tertiary} extrasByType={extrasByType} expanded={expanded} onToggle={toggleExtras} onClick={handleClick} />
      </div>
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
};

function Section({ title, actions, extrasByType, expanded, onToggle, onClick }: SectionProps) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{title}</p>
      <div className="space-y-3">
        {actions.map((action) => {
          const extras = extrasByType[action.type] ?? [];
          const isOpen = expanded[action.type];
          const duplicateCount = extras.length;
          return (
            <div
              key={`${action.type}-${action.href}-${action.appId ?? "na"}`}
              className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    {formatType(action.type)}
                  </p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{action.title}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">{action.why}</p>
                </div>
                <Link
                  href={action.href}
                  onClick={() => onClick(action)}
                  className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
                >
                  {ctaLabel(action.type, action.href)}
                </Link>
              </div>
              {duplicateCount > 0 ? (
                <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                  <button
                    type="button"
                    className="font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                    onClick={() => onToggle(action.type)}
                  >
                    Also needed for {duplicateCount} other application{duplicateCount > 1 ? "s" : ""}
                  </button>
                </div>
              ) : null}
              {duplicateCount > 0 && isOpen ? (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  {extras.map((extra) => (
                    <div key={`${extra.href}-${extra.appId ?? "extra"}`} className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{extra.title}</p>
                        <p className="text-xs text-[rgb(var(--muted))]">{extra.why}</p>
                      </div>
                      <Link
                        href={extra.href}
                        onClick={() => onClick(extra)}
                        className="rounded-full bg-[rgb(var(--accent))] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
                      >
                        {ctaLabel(extra.type, extra.href)}
                      </Link>
                    </div>
                  ))}
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
