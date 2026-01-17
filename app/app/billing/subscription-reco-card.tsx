"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SubscriptionReco } from "@/lib/billing/subscription-reco";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans-data";
import { formatGbp } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  reco: SubscriptionReco;
  applicationId: string | null;
  hasSubscription?: boolean;
  returnTo?: string;
  planAvailable?: boolean;
};

export default function BillingSubscriptionRecoCard({
  reco,
  applicationId,
  hasSubscription,
  returnTo = "/app/billing",
  planAvailable = true,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const viewLogged = useRef(false);
  const unavailableLogged = useRef(false);

  const plan = useMemo(
    () => SUBSCRIPTION_PLANS.find((p) => p.key === reco.recommendedPlanKey) ?? null,
    [reco.recommendedPlanKey]
  );
  const unavailable = !plan || !planAvailable;

  useEffect(() => {
    if (!plan || viewLogged.current) return;
    viewLogged.current = true;
    logMonetisationClientEvent("billing_sub_reco_view", applicationId ?? null, "billing", {
      planKey: plan.key,
      reasonKey: reco.reasonKey,
    });
  }, [applicationId, plan, reco.reasonKey]);

  useEffect(() => {
    if (!plan || !unavailable || unavailableLogged.current) return;
    unavailableLogged.current = true;
    logMonetisationClientEvent("billing_plan_unavailable", applicationId ?? null, "billing", {
      planKey: plan.key,
    });
  }, [applicationId, plan, unavailable]);

  if (!plan) return null;

  const handleCheckout = async () => {
    if (unavailable) {
      logMonetisationClientEvent("billing_plan_unavailable", applicationId ?? null, "billing", {
        planKey: plan.key,
      });
      setError("This plan isn’t available right now.");
      return;
    }
    setLoading(true);
    setError(null);
    logMonetisationClientEvent("billing_sub_reco_click", applicationId ?? null, "billing", {
      planKey: plan.key,
      reasonKey: reco.reasonKey,
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
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        logMonetisationClientEvent(
          "billing_sub_reco_checkout_started",
          applicationId ?? null,
          "billing",
          { planKey: plan.key, reasonKey: reco.reasonKey }
        );
        window.location.href = payload.url as string;
        return;
      }
      logMonetisationClientEvent(
        "billing_sub_reco_checkout_failed",
        applicationId ?? null,
        "billing",
        { planKey: plan.key, reasonKey: reco.reasonKey, status: response.status }
      );
      setError("We couldn’t start checkout. Please try again.");
    } catch (error) {
      logMonetisationClientEvent(
        "billing_sub_reco_checkout_failed",
        applicationId ?? null,
        "billing",
        { planKey: plan.key, reasonKey: reco.reasonKey, status: "network_error" }
      );
      setError("We couldn’t start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">Monthly credits</p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">
            {reco.copy.title}
          </p>
          <p className="text-sm text-[rgb(var(--muted))]">{reco.copy.subtitle}</p>
          <ul className="mt-1 space-y-1 text-sm text-[rgb(var(--muted))]">
            {reco.copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || unavailable}
            className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {unavailable
              ? "Subscription unavailable"
              : loading
                ? "Starting checkout..."
                : `Start subscription — ${formatGbp(plan.priceGbp)}/mo`}
          </button>
          {hasSubscription ? (
            <form action="/api/stripe/portal" method="POST">
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              >
                Manage subscription
              </button>
            </form>
          ) : null}
          {unavailable ? (
            <p className="text-xs text-amber-700">This plan isn’t available right now.</p>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Checkout couldn’t start.</p>
          <p className="text-xs text-amber-700">
            We couldn’t start checkout. Please try again. If it keeps happening, try again in a moment.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                logMonetisationClientEvent("checkout_retry_click", applicationId ?? null, "billing", {
                  planKey: plan.key,
                });
                handleCheckout();
              }}
              className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
              disabled={loading || unavailable}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                logMonetisationClientEvent(
                  "checkout_start_failed",
                  applicationId ?? null,
                  "billing",
                  { planKey: plan.key, status: "dismissed" }
                );
                setError(null);
              }}
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
