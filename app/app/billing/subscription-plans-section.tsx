"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SubscriptionPlanSelector from "./subscription-plan-selector";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/billing/plans-data";
import { formatGbp } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import CompareCard from "./compare-card";
import type { CompareResult } from "@/lib/billing/compare";

type PlanKey = "monthly_30" | "monthly_80";

type Props = {
  applicationId: string | null;
  recommendedPlanKey: PlanKey;
  reasonChips: string[];
  planAvailability: { monthly_30?: boolean; monthly_80?: boolean };
  hasSubscription: boolean;
  currentPlanKey: PlanKey | null;
  canManageInPortal: boolean;
  returnTo: string;
  comparison: CompareResult;
  recommendedPack: { key: string; name: string; priceGbp: number };
  packAvailable: boolean;
};

export default function SubscriptionPlansSection({
  applicationId,
  recommendedPlanKey,
  reasonChips,
  planAvailability,
  hasSubscription,
  currentPlanKey,
  canManageInPortal,
  returnTo,
  comparison,
  recommendedPack,
  packAvailable,
}: Props) {
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>(recommendedPlanKey);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonLogged = useRef(false);
  const manageLogged = useRef(false);

  useEffect(() => {
    if (reasonLogged.current) return;
    reasonLogged.current = true;
    if (reasonChips.length > 0) {
      logMonetisationClientEvent("sub_reco_reason_impression", applicationId ?? null, "billing", {
        reasonCount: reasonChips.length,
      });
    }
  }, [applicationId, reasonChips.length]);

  useEffect(() => {
    if (!hasSubscription || manageLogged.current) return;
    manageLogged.current = true;
    logMonetisationClientEvent("sub_manage_view", applicationId ?? null, "billing", {
      currentPlanKey,
    });
  }, [applicationId, currentPlanKey, hasSubscription]);

  const selectedPlan: SubscriptionPlan =
    useMemo(
      () => SUBSCRIPTION_PLANS.find((plan) => plan.key === selectedPlanKey) ?? SUBSCRIPTION_PLANS[0],
      [selectedPlanKey]
    );

  const selectedPlanAvailable = planAvailability[selectedPlanKey] ?? true;
  const isCurrent = currentPlanKey === selectedPlanKey;

  const handleCheckout = async () => {
    if (!selectedPlanAvailable) {
      logMonetisationClientEvent("sub_selector_plan_unavailable", applicationId ?? null, "billing", {
        planKey: selectedPlanKey,
      });
      setError("This plan isn’t available right now.");
      return;
    }
    setLoading(true);
    setError(null);
    logMonetisationClientEvent("sub_selector_start_checkout", applicationId ?? null, "billing", {
      planKey: selectedPlanKey,
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "subscription",
          planKey: selectedPlanKey,
          returnTo,
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("We couldn’t start checkout. Please try again.");
    } catch {
      setError("We couldn’t start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    if (!canManageInPortal) {
      setError("Couldn’t open subscription settings. Please try again.");
      return;
    }
    setPortalLoading(true);
    setError(null);
    logMonetisationClientEvent("sub_selector_manage_portal_click", applicationId ?? null, "billing", {
      planKey: selectedPlanKey,
    });
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ returnTo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("We couldn’t open the subscription portal. Please try again.");
    } catch {
      setError("We couldn’t open the subscription portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgradeDowngrade = async (target: PlanKey, flow: string) => {
    setPortalLoading(true);
    setError(null);
    logMonetisationClientEvent(
      target === "monthly_80" ? "sub_upgrade_click" : "sub_downgrade_click",
      applicationId ?? null,
      "billing",
      { from: currentPlanKey, to: target }
    );
    try {
      const response = await fetch(
        `/api/stripe/portal?flow=${encodeURIComponent(flow)}&returnTo=${encodeURIComponent(returnTo)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      logMonetisationClientEvent("sub_portal_open_failed", applicationId ?? null, "billing", {
        planKey: target,
      });
      setError("Couldn’t open subscription settings. Please try again.");
    } catch {
      logMonetisationClientEvent("sub_portal_open_failed", applicationId ?? null, "billing", {
        planKey: target,
      });
      setError("Couldn’t open subscription settings. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const renderManageActions = () => {
    if (!hasSubscription) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {currentPlanKey === "monthly_30" && planAvailability.monthly_80 ? (
          <button
            type="button"
            onClick={() => handleUpgradeDowngrade("monthly_80", "upgrade_80")}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            disabled={portalLoading}
          >
            {portalLoading ? "Opening…" : "Upgrade to Monthly 80"}
          </button>
        ) : null}
        {currentPlanKey === "monthly_80" && planAvailability.monthly_30 ? (
          <button
            type="button"
            onClick={() => handleUpgradeDowngrade("monthly_30", "downgrade_30")}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            disabled={portalLoading}
          >
            {portalLoading ? "Opening…" : "Downgrade to Monthly 30"}
          </button>
        ) : null}
        {canManageInPortal ? (
          <button
            type="button"
            onClick={handleManage}
            disabled={portalLoading}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {portalLoading ? "Opening…" : "Manage in Stripe"}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm">
      <SubscriptionPlanSelector
        selectedPlanKey={selectedPlanKey}
        recommendedPlanKey={recommendedPlanKey}
        onChange={setSelectedPlanKey}
        planAvailability={planAvailability}
        applicationId={applicationId ?? undefined}
        surface="billing"
        variant="billing"
      />
      <div className="flex flex-wrap gap-2">
        {reasonChips.slice(0, 3).map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-[rgb(var(--muted))]"
          >
            {chip}
          </span>
        ))}
      </div>
      {hasSubscription ? (
        <div className="text-sm text-[rgb(var(--muted))]">
          Current: {currentPlanKey === "monthly_80" ? "Monthly 80" : "Monthly 30"}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading || !selectedPlanAvailable || hasSubscription}
          className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!selectedPlanAvailable
            ? "Plan unavailable"
            : hasSubscription
              ? "Already subscribed"
              : loading
                ? "Starting checkout..."
                : `Start subscription — ${formatGbp(selectedPlan.priceGbp)}/mo`}
        </button>
        {renderManageActions()}
      </div>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      <CompareCard
        comparison={comparison}
        applicationId={applicationId}
        recommendedPack={recommendedPack}
        returnTo={returnTo}
        packAvailable={packAvailable}
        subscriptionAvailable={planAvailability[selectedPlanKey] ?? true}
        selectedPlanKey={selectedPlanKey}
      />
    </div>
  );
}
