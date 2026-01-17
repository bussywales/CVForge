"use client";

import { useEffect, useRef } from "react";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/billing/plans-data";
import { formatGbp } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type PlanKey = "monthly_30" | "monthly_80";

type Props = {
  selectedPlanKey: PlanKey;
  recommendedPlanKey: PlanKey;
  onChange: (planKey: PlanKey) => void;
  planAvailability?: Partial<Record<PlanKey, boolean>>;
  applicationId?: string | null;
  surface?: "billing" | "gate";
  variant?: "billing" | "gate";
};

export default function SubscriptionPlanSelector({
  selectedPlanKey,
  recommendedPlanKey,
  onChange,
  planAvailability,
  applicationId,
  surface = "billing",
  variant = "billing",
}: Props) {
  const viewLogged = useRef(false);
  const unavailableLogged = useRef<Record<PlanKey, boolean>>({} as Record<PlanKey, boolean>);

  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    logMonetisationClientEvent("sub_selector_view", applicationId ?? null, surface, {
      recommendedPlanKey,
      selectedPlanKey,
    });
  }, [applicationId, recommendedPlanKey, selectedPlanKey, surface]);

  const plans: SubscriptionPlan[] = SUBSCRIPTION_PLANS;

  const handleSelect = (planKey: PlanKey, available: boolean) => {
    if (!available) {
      if (!unavailableLogged.current[planKey]) {
        logMonetisationClientEvent("sub_selector_plan_unavailable", applicationId ?? null, surface, {
          planKey,
        });
        unavailableLogged.current[planKey] = true;
      }
      return;
    }
    if (planKey === selectedPlanKey) return;
    logMonetisationClientEvent("sub_selector_change_plan", applicationId ?? null, surface, {
      from: selectedPlanKey,
      to: planKey,
    });
    onChange(planKey);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Choose your monthly plan</p>
      </div>
      <div className={`grid gap-3 ${variant === "billing" ? "md:grid-cols-2" : "grid-cols-2"}`}>
        {plans.map((plan) => {
          const isRecommended = plan.key === recommendedPlanKey;
          const isSelected = plan.key === selectedPlanKey;
          const available = planAvailability?.[plan.key] ?? true;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => handleSelect(plan.key, available)}
              className={`text-left rounded-2xl border px-4 py-3 shadow-sm transition ${
                isSelected
                  ? "border-indigo-300 bg-indigo-50/70"
                  : "border-black/10 bg-white/80 hover:bg-slate-50"
              } ${available ? "" : "opacity-60 cursor-not-allowed"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {plan.key === "monthly_30" ? "Monthly 30" : "Monthly 80"}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    {plan.creditsPerMonth} credits / month • {formatGbp(plan.priceGbp)}/mo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isRecommended ? (
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                      Recommended
                    </span>
                  ) : null}
                  <span
                    className={`h-3 w-3 rounded-full ${
                      isSelected ? "bg-[rgb(var(--ink))]" : "bg-slate-200"
                    }`}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                {plan.key === "monthly_30"
                  ? "Best for steady applications each week."
                  : "Best for fast, high-volume applying."}
              </p>
              {!available ? (
                <p className="mt-2 text-xs text-amber-700">This plan isn’t available right now.</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
