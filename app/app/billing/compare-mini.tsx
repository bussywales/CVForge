"use client";

import { useEffect, useState } from "react";
import { formatGbp } from "@/lib/billing/packs-data";
import { CompareResult } from "@/lib/billing/compare";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  comparison: CompareResult;
  applicationId: string;
  pack: { key: string; name: string; priceGbp: number };
  returnTo: string;
  surface?: string;
  packAvailable: boolean;
  subscriptionAvailable: boolean;
};

export default function CompareMini({
  comparison,
  applicationId,
  pack,
  returnTo,
  surface = "gate",
  packAvailable,
  subscriptionAvailable,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"topup" | "subscribe" | null>(null);
  const subscriptionUnavailable = !subscriptionAvailable;

  useEffect(() => {
    logMonetisationClientEvent("gate_compare_view", applicationId, surface, {
      recommendedChoice: comparison.recommendedChoice,
    });
    if (subscriptionUnavailable) {
      logMonetisationClientEvent("sub_gate_plan_unavailable", applicationId, surface, {
        planKey: comparison.suggestedPlanKey,
        surface: "gate_compare",
      });
    }
  }, [applicationId, comparison.recommendedChoice, comparison.suggestedPlanKey, subscriptionUnavailable, surface]);

  const startTopup = async () => {
    setError(null);
    setLoading("topup");
    logMonetisationClientEvent("gate_compare_choice_topup", applicationId, surface, {
      packKey: pack.key,
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packKey: pack.key, returnTo, applicationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("Unable to start checkout.");
    } catch {
      setError("Unable to start checkout.");
    } finally {
      setLoading(null);
    }
  };

  const startSubscription = async () => {
    if (subscriptionUnavailable) {
      setError("Subscription isn’t available right now.");
      return;
    }
    setError(null);
    setLoading("subscribe");
    logMonetisationClientEvent("gate_compare_choice_subscribe", applicationId, surface, {
      planKey: comparison.suggestedPlanKey,
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "subscription",
          planKey: comparison.suggestedPlanKey,
          returnTo,
          applicationId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("Unable to start checkout.");
    } catch {
      setError("Unable to start checkout.");
    } finally {
      setLoading(null);
    }
  };

  const topupRecommended = comparison.recommendedChoice === "topup";
  const subscriptionRecommended = comparison.recommendedChoice === "subscription";
  const reasonChips = comparison.reasons.slice(0, 2);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--ink))]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Save money if you’re applying consistently</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">
            Choose a one-off top up, or subscribe and keep momentum without interruptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {reasonChips.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[rgb(var(--muted))]"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className={`rounded-2xl border p-2 ${topupRecommended ? "border-indigo-200 bg-indigo-50/60" : "border-black/10 bg-white"}`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Top up once</p>
            {topupRecommended ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Recommended
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[rgb(var(--muted))]">Best for one application right now.</p>
          <button
            type="button"
            onClick={startTopup}
            disabled={!packAvailable || loading === "topup"}
            className="mt-2 w-full rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "topup" ? "Starting..." : "Top up"}
          </button>
          <p className="mt-1 text-[10px] text-[rgb(var(--muted))]">
            {formatGbp(pack.priceGbp)} • {pack.name}
          </p>
        </div>
        <div className={`rounded-2xl border p-2 ${subscriptionRecommended ? "border-indigo-200 bg-indigo-50/60" : "border-black/10 bg-white"}`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Subscribe monthly</p>
            {subscriptionRecommended ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Recommended
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[rgb(var(--muted))]">Best for steady applications each week.</p>
          <button
            type="button"
            onClick={startSubscription}
            disabled={subscriptionUnavailable || loading === "subscribe"}
            className="mt-2 w-full rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {subscriptionUnavailable
              ? "Subscription unavailable"
              : loading === "subscribe"
                ? "Starting..."
                : "Subscribe"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
