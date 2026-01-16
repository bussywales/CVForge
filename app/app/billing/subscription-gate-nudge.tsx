"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUBSCRIPTION_PLANS, resolvePriceIdForPlan } from "@/lib/billing/plans";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  recommendedPlanKey: "monthly_30" | "monthly_80" | null | undefined;
  context: "autopack" | "interview_pack" | "kit" | "answer_pack";
  returnTo: string;
  applicationId: string;
  onSubscribedStart?: () => void;
  hasSubscription?: boolean;
};

export default function SubscriptionGateNudge({
  recommendedPlanKey,
  context,
  returnTo,
  applicationId,
  onSubscribedStart,
  hasSubscription,
}: Props) {
  const plan = useMemo(
    () => SUBSCRIPTION_PLANS.find((item) => item.key === recommendedPlanKey) ?? null,
    [recommendedPlanKey]
  );
  const priceId = plan ? resolvePriceIdForPlan(plan.key) : null;
  const unavailable = !priceId;
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const viewLogged = useRef(false);
  const unavailableLogged = useRef(false);

  useEffect(() => {
    if (!plan || dismissed || viewLogged.current) return;
    viewLogged.current = true;
    logMonetisationClientEvent("sub_gate_view", applicationId, "gate", {
      context,
      planKey: plan.key,
      hasSubscription: Boolean(hasSubscription),
    });
  }, [applicationId, context, dismissed, hasSubscription, plan]);

  useEffect(() => {
    if (!plan || !unavailable || unavailableLogged.current) return;
    unavailableLogged.current = true;
    logMonetisationClientEvent(
      "sub_gate_plan_unavailable",
      applicationId,
      "gate",
      { context, planKey: plan.key }
    );
  }, [applicationId, context, plan, unavailable]);

  if (!plan || dismissed) return null;

  const handleCheckout = async () => {
    if (unavailable) {
      setError("Subscription isn’t available right now.");
      logMonetisationClientEvent("sub_gate_plan_unavailable", applicationId, "gate", {
        context,
        planKey: plan.key,
      });
      return;
    }
    setLoading(true);
    setError(null);
    onSubscribedStart?.();
    logMonetisationClientEvent("sub_gate_click_subscribe", applicationId, "gate", {
      context,
      planKey: plan.key,
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "subscription",
          planKey: plan.key,
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
        { context, planKey: plan.key, status: response.status }
      );
      setError("We couldn’t start subscription checkout.");
    } catch (error) {
      logMonetisationClientEvent(
        "sub_gate_checkout_start_failed",
        applicationId,
        "gate",
        { context, planKey: plan.key, status: "network_error" }
      );
      setError("We couldn’t start subscription checkout.");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = () => {
    logMonetisationClientEvent("sub_gate_click_subscribe", applicationId, "gate", {
      context,
      planKey: plan.key,
      action: "manage",
    });
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-3 text-sm text-[rgb(var(--ink))]">
      <p className="text-sm font-semibold">Better value: subscribe</p>
      <p className="text-xs text-[rgb(var(--muted))]">
        If you’ll apply to more than a couple of roles this month, a subscription is cheaper.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {hasSubscription ? (
          <form action="/api/stripe/portal" method="POST" onSubmit={handleManage}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white hover:bg-black"
            >
              Manage subscription
            </button>
          </form>
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
                : "Subscribe (recommended)"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            logMonetisationClientEvent("sub_gate_not_now", applicationId, "gate", {
              context,
              planKey: plan.key,
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
