"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans-data";
import { formatGbp } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import SubscriptionPlanSelector from "./subscription-plan-selector";

type PlanKey = "monthly_30" | "monthly_80";

type Props = {
  recommendedPlanKey: PlanKey | null | undefined;
  context: "autopack" | "interview_pack" | "kit" | "answer_pack";
  returnTo: string;
  applicationId: string;
  onSubscribedStart?: () => void;
  hasSubscription?: boolean;
  planAvailability?: { monthly_30?: boolean; monthly_80?: boolean };
  currentPlanKey?: PlanKey | null;
  upgradeSuggested?: boolean;
};

export default function SubscriptionGateNudge({
  recommendedPlanKey,
  context,
  returnTo,
  applicationId,
  onSubscribedStart,
  hasSubscription,
  planAvailability,
  currentPlanKey,
  upgradeSuggested,
}: Props) {
  const recommendedPlan = useMemo(
    () => SUBSCRIPTION_PLANS.find((item) => item.key === recommendedPlanKey) ?? SUBSCRIPTION_PLANS[0],
    [recommendedPlanKey]
  );
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>(recommendedPlan.key);
  const selectedPlan =
    SUBSCRIPTION_PLANS.find((item) => item.key === selectedPlanKey) ?? SUBSCRIPTION_PLANS[0];
  const available =
    planAvailability?.[selectedPlanKey] ??
    (selectedPlanKey === "monthly_30"
      ? planAvailability?.monthly_30 ?? true
      : planAvailability?.monthly_80 ?? true);
  const unavailable = !available;
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const viewLogged = useRef(false);
  const unavailableLogged = useRef<Record<PlanKey, boolean>>({} as Record<PlanKey, boolean>);

  useEffect(() => {
    if (dismissed || viewLogged.current) return;
    viewLogged.current = true;
    logMonetisationClientEvent("sub_gate_view", applicationId, "gate", {
      context,
      planKey: selectedPlanKey,
      hasSubscription: Boolean(hasSubscription),
    });
    logMonetisationClientEvent("sub_selector_view", applicationId, "gate", {
      recommendedPlanKey: recommendedPlan.key,
      selectedPlanKey,
    });
  }, [applicationId, context, dismissed, hasSubscription, recommendedPlan.key, selectedPlanKey]);

  useEffect(() => {
    if (!unavailable || unavailableLogged.current[selectedPlanKey]) return;
    unavailableLogged.current[selectedPlanKey] = true;
    logMonetisationClientEvent(
      "sub_gate_plan_unavailable",
      applicationId,
      "gate",
      { context, planKey: selectedPlanKey }
    );
    logMonetisationClientEvent("sub_selector_plan_unavailable", applicationId, "gate", {
      planKey: selectedPlanKey,
    });
  }, [applicationId, context, selectedPlanKey, unavailable]);

  if (dismissed) return null;

  const handleCheckout = async () => {
    if (unavailable) {
      setError("Subscription isn’t available right now.");
      logMonetisationClientEvent("sub_gate_plan_unavailable", applicationId, "gate", {
        context,
        planKey: selectedPlanKey,
      });
      return;
    }
    setLoading(true);
    setError(null);
    onSubscribedStart?.();
    logMonetisationClientEvent("sub_gate_click_subscribe", applicationId, "gate", {
      context,
      planKey: selectedPlanKey,
    });
    logMonetisationClientEvent("sub_selector_start_checkout", applicationId, "gate", {
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
          applicationId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      logMonetisationClientEvent(
        "sub_gate_checkout_start_failed",
        applicationId,
        "gate",
        { context, planKey: selectedPlanKey, status: response.status }
      );
      setError("We couldn’t start subscription checkout.");
    } catch (error) {
      logMonetisationClientEvent(
        "sub_gate_checkout_start_failed",
        applicationId,
        "gate",
        { context, planKey: selectedPlanKey, status: "network_error" }
      );
      setError("We couldn’t start subscription checkout.");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = () => {
    logMonetisationClientEvent("sub_gate_click_subscribe", applicationId, "gate", {
      context,
      planKey: selectedPlanKey,
      action: "manage",
    });
    logMonetisationClientEvent("sub_selector_manage_portal_click", applicationId, "gate", {
      planKey: selectedPlanKey,
    });
    setPortalLoading(true);
    setError(null);
    fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ returnTo }),
    })
      .then((res) => res.json().catch(() => ({})).then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (ok && payload?.url) {
          window.location.href = payload.url as string;
          return;
        }
        setPortalError("We couldn’t open the subscription portal. Please try again.");
      })
      .catch(() => {
        setPortalError("We couldn’t open the subscription portal. Please try again.");
      })
      .finally(() => setPortalLoading(false));
  };

  const handleUpgrade = () => {
    setPortalLoading(true);
    setPortalError(null);
    logMonetisationClientEvent("sub_upgrade_click", applicationId, "gate", {
      context,
      planKey: "monthly_80",
    });
    fetch(`/api/stripe/portal?flow=upgrade_80&returnTo=${encodeURIComponent(returnTo)}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json().catch(() => ({})).then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (ok && payload?.url) {
          window.location.href = payload.url as string;
          return;
        }
        setPortalError("We couldn’t open the subscription portal. Please try again.");
      })
      .catch(() => {
        setPortalError("We couldn’t open the subscription portal. Please try again.");
      })
      .finally(() => setPortalLoading(false));
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-3 text-sm text-[rgb(var(--ink))]">
      <p className="text-sm font-semibold">Better value: subscribe</p>
      <p className="text-xs text-[rgb(var(--muted))]">
        If you’ll apply to more than a couple of roles this month, a subscription is cheaper.
      </p>
      <div className="mt-2">
        <SubscriptionPlanSelector
          selectedPlanKey={selectedPlanKey}
          recommendedPlanKey={recommendedPlan.key}
          onChange={(planKey) => setSelectedPlanKey(planKey)}
          planAvailability={planAvailability}
          applicationId={applicationId}
          surface="gate"
          variant="gate"
        />
        {recommendedPlan.key === "monthly_30" && selectedPlanKey === "monthly_30" ? (
          <button
            type="button"
            onClick={() => setSelectedPlanKey("monthly_80")}
            className="mt-1 text-[11px] font-semibold text-indigo-700 underline"
          >
            Need more credits? Switch to Monthly 80.
          </button>
        ) : null}
        {currentPlanKey === "monthly_30" && upgradeSuggested ? (
          <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2 text-xs text-[rgb(var(--ink))]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Applying heavily this week? Upgrade to Monthly 80 for fewer interruptions.</span>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={portalLoading}
                className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portalLoading ? "Opening…" : "Upgrade to Monthly 80"}
              </button>
            </div>
            {portalError ? (
              <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                <span>We couldn’t open the subscription portal. Please try again.</span>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    className="rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-800"
                    disabled={portalLoading}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalError(null)}
                    className="rounded-full border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {hasSubscription ? (
          <button
            type="button"
            onClick={handleManage}
            disabled={portalLoading}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {portalLoading ? "Opening…" : "Manage subscription"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || unavailable}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {unavailable
              ? "Subscription unavailable"
              : loading
                ? "Starting checkout..."
                : `Subscribe — ${formatPrice(selectedPlan.key)}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            logMonetisationClientEvent("sub_gate_not_now", applicationId, "gate", {
              context,
              planKey: selectedPlanKey,
            });
          }}
          className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[rgb(var(--muted))] hover:bg-slate-50"
        >
          Not now
        </button>
      </div>
      {unavailable ? (
        <p className="mt-2 text-xs text-amber-700">Subscription isn’t available right now.</p>
      ) : null}
      {error ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <p className="font-semibold">Checkout couldn’t start.</p>
          <p>Please try again.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleCheckout}
              className="rounded-full bg-amber-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
              disabled={loading || unavailable}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-full border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatPrice(planKey: PlanKey) {
  const plan = SUBSCRIPTION_PLANS.find((item) => item.key === planKey);
  if (!plan) return "£—/mo";
  return `${formatGbp(plan.priceGbp)}/mo`;
}
