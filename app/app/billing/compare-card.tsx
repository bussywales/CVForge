"use client";

import { useEffect, useMemo, useState } from "react";
import { formatGbp, resolvePriceIdForPack } from "@/lib/billing/packs";
import { resolvePriceIdForPlan } from "@/lib/billing/plans";
import { CompareResult } from "@/lib/billing/compare";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  comparison: CompareResult;
  applicationId: string | null;
  recommendedPack: { key: string; name: string; priceGbp: number };
  returnTo: string;
};

export default function CompareCard({
  comparison,
  applicationId,
  recommendedPack,
  returnTo,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"topup" | "subscribe" | null>(null);
  const packPriceId = useMemo(
    () => resolvePriceIdForPack(recommendedPack.key),
    [recommendedPack.key]
  );
  const planPriceId = useMemo(
    () => resolvePriceIdForPlan(comparison.suggestedPlanKey),
    [comparison.suggestedPlanKey]
  );
  const subscriptionUnavailable = !planPriceId;

  useEffect(() => {
    logMonetisationClientEvent("billing_compare_view", applicationId ?? null, "billing", {
      recommendedChoice: comparison.recommendedChoice,
    });
    if (subscriptionUnavailable) {
      logMonetisationClientEvent("billing_plan_unavailable", applicationId ?? null, "billing", {
        planKey: comparison.suggestedPlanKey,
        surface: "billing_compare",
      });
    }
  }, [applicationId, comparison.recommendedChoice, comparison.suggestedPlanKey, subscriptionUnavailable]);

  const startTopup = async () => {
    setLoading("topup");
    setError(null);
    logMonetisationClientEvent("billing_compare_choice_topup", applicationId ?? null, "billing", {
      packKey: recommendedPack.key,
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packKey: recommendedPack.key,
          returnTo,
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("Unable to start checkout. Please try again.");
    } catch {
      setError("Unable to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const startSubscription = async () => {
    if (subscriptionUnavailable) {
      setError("Subscription isn’t available right now.");
      return;
    }
    setLoading("subscribe");
    setError(null);
    logMonetisationClientEvent("billing_compare_choice_subscribe", applicationId ?? null, "billing", {
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
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
        return;
      }
      setError("Unable to start checkout. Please try again.");
    } catch {
      setError("Unable to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const topupRecommended = comparison.recommendedChoice === "topup";
  const subscriptionRecommended = comparison.recommendedChoice === "subscription";

  const reasonChips = comparison.reasons.slice(0, 3);

  const renderColumn = (
    type: "topup" | "subscription",
    {
      title,
      subtitle,
      cta,
      onClick,
      disabled,
      recommended,
    }: { title: string; subtitle: string; cta: string; onClick: () => void; disabled?: boolean; recommended?: boolean }
  ) => (
    <div
      className={`flex-1 rounded-2xl border p-4 shadow-sm ${
        recommended ? "border-indigo-300 bg-indigo-50/60" : "border-black/10 bg-white/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{title}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{subtitle}</p>
        </div>
        {recommended ? (
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            Recommended
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-1 text-xs text-[rgb(var(--muted))]">
        {comparison.rows.map((row) => (
          <div key={`${row.label}-${type}`} className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[rgb(var(--ink))]">{row.label}</span>
            <span>{type === "topup" ? row.topup : row.subscription}</span>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading === type}
          className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
            recommended
              ? "bg-[rgb(var(--ink))] text-white hover:bg-black"
              : "bg-white text-[rgb(var(--ink))] border border-black/10 hover:bg-slate-50"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {disabled ? "Subscription unavailable" : loading === type ? "Starting..." : cta}
        </button>
        {type === "topup" ? (
          <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">
            {`Top up ${formatGbp(recommendedPack.priceGbp)} (${recommendedPack.name})`}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Save money if you’re applying consistently
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            Choose a one-off top up, or subscribe and keep momentum without interruptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {reasonChips.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-[rgb(var(--muted))]"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {renderColumn("topup", {
          title: "Top up once",
          subtitle: "Best for one application right now.",
          cta: `Top up`,
          onClick: startTopup,
          recommended: topupRecommended,
          disabled: !packPriceId,
        })}
        {renderColumn("subscription", {
          title: "Subscribe monthly",
          subtitle: "Best for steady applications each week.",
          cta: "Subscribe",
          onClick: startSubscription,
          recommended: subscriptionRecommended,
          disabled: subscriptionUnavailable,
        })}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
