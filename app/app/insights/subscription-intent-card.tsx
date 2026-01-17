"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type PlanKey = "monthly_30" | "monthly_80";

type Props = {
  weekKey: string;
  recommendation: {
    shouldShow: boolean;
    recommendedPlan: PlanKey;
    reasons: string[];
  };
};

const WHY_POINTS = [
  "Never run out mid-week",
  "Finish paid steps faster",
  "Best value if you’re applying daily",
  "Keeps momentum on multiple roles",
];

export default function SubscriptionIntentCard({ weekKey, recommendation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = useMemo(() => `intent_tile_dismissed:${weekKey}`, [weekKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem(storageKey);
    if (flag === "1") {
      setDismissed(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!dismissed && recommendation.shouldShow) {
      logMonetisationClientEvent("intent_tile_view", null, "insights", {
        planKey: recommendation.recommendedPlan,
        week: weekKey,
      });
    }
  }, [dismissed, recommendation.recommendedPlan, recommendation.shouldShow, weekKey]);

  if (!recommendation.shouldShow || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "1");
    }
    logMonetisationClientEvent("intent_tile_dismiss", null, "insights", { week: weekKey });
  };

  const planButtons: PlanKey[] = ["monthly_30", "monthly_80"];

  return (
    <div className="rounded-3xl border border-indigo-100 bg-white/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Subscription Intent</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">Lock in your weekly momentum</p>
          <p className="text-sm text-[rgb(var(--muted))]">
            {recommendation.reasons[0] ?? "Subscription keeps you moving even when credits run low."}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
          onClick={handleDismiss}
        >
          Not now
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {planButtons.map((planKey) => {
          const isRecommended = planKey === recommendation.recommendedPlan;
          return (
            <Link
              key={planKey}
              href={`/app/billing?from=intent_tile&plan=${planKey}`}
              onClick={() =>
                logMonetisationClientEvent("intent_tile_click_plan", null, "insights", {
                  planKey,
                  week: weekKey,
                })
              }
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                planKey === "monthly_80" ? "bg-[rgb(var(--ink))] hover:bg-black" : "bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-strong))]"
              }`}
            >
              {planKey === "monthly_80" ? "Start Monthly 80" : "Start Monthly 30"}
              {isRecommended ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">Recommended</span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
          onClick={() => {
            setExpanded((prev) => !prev);
            if (!expanded) {
              logMonetisationClientEvent("intent_tile_expand_why", null, "insights", { week: weekKey });
            }
          }}
        >
          Why subscription?
        </button>
      </div>
      {expanded ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--muted))]">
          {WHY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {recommendation.reasons.slice(0, 3).map((reason) => (
          <span key={reason} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-[rgb(var(--muted))]">
            {reason}
          </span>
        ))}
      </div>
    </div>
  );
}
