"use client";

import { useEffect, useMemo, useState } from "react";
import { CREDIT_PACKS, type CreditPack, formatGbp } from "@/lib/billing/packs-data";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/billing/plans-data";
import { buildCompareRecommendation, type CompareRecommendation } from "@/lib/billing/compare-reco";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { withRequestIdHeaders } from "@/lib/observability/request-id";
import { safeReadJson } from "@/lib/http/safe-json";
import ErrorBanner from "@/components/ErrorBanner";
import { ERROR_COPY } from "@/lib/microcopy/errors";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

type Props = {
  hasSubscription: boolean;
  currentPlanKey?: "monthly_30" | "monthly_80" | null;
  activeApplications: number;
  weeklyStreakActive?: boolean;
  completions7: number;
  credits: number;
  topups30: number;
  planAvailability: { monthly_30?: boolean; monthly_80?: boolean };
  packAvailability: Partial<Record<CreditPack["key"], boolean>>;
  subscriptionAvailable: boolean;
  applicationId?: string | null;
  returnTo?: string;
};

const COPY = {
  title: "Choose the best option for you",
  subtitle: "Pick the plan that matches your job search pace — we’ll recommend one.",
  subscription: {
    title: "Subscription",
    tagline: "Best for weekly momentum",
    bullets: ["Keeps you applying every week", "Less decision-making, more shipping", "Upgrade or downgrade anytime"],
    cta: "Start subscription",
    manage: "Manage subscription",
  },
  topup: {
    title: "Top-up credits",
    tagline: "Best for a focused push",
    bullets: ["Finish 1–2 applications now", "Pay once, use when needed", "Great for one-off deadlines"],
    cta: "Top up now",
  },
  recommended: "Recommended",
  whyOpen: "Why this?",
  whyClose: "Hide why",
  secondary: "Choose this instead",
  reasons: {
    weekly_momentum: "Recommended because you’re building weekly momentum.",
    single_push: "Recommended because you’re in a focused push right now.",
    heavy_user_upgrade: "Recommended because your usage fits the Monthly 80 plan.",
    already_subscribed: "You’re already subscribed — keep your momentum going.",
  },
};

export default function CompareCard({
  hasSubscription,
  currentPlanKey,
  activeApplications,
  weeklyStreakActive,
  completions7,
  credits,
  topups30,
  planAvailability,
  packAvailability,
  subscriptionAvailable,
  applicationId,
  returnTo = "/app/billing",
}: Props) {
  const recommendation: CompareRecommendation = useMemo(
    () =>
      buildCompareRecommendation({
        hasSubscription,
        currentPlanKey,
        activeApplications,
        weeklyStreakActive,
        completions7,
        credits,
        topups30,
        subscriptionAvailable,
        packAvailability,
      }),
    [hasSubscription, currentPlanKey, activeApplications, weeklyStreakActive, completions7, credits, topups30, subscriptionAvailable, packAvailability]
  );
  const [showWhy, setShowWhy] = useState(false);
  const isSubscriptionReco = recommendation.recommended === "subscription";
  const recommendedPlan: SubscriptionPlan | undefined = SUBSCRIPTION_PLANS.find(
    (plan) => plan.key === recommendation.recommendedPlanKey
  );
  const recommendedPack: CreditPack | undefined = CREDIT_PACKS.find((pack) => pack.key === recommendation.recommendedPackKey);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [supportSnippet, setSupportSnippet] = useState<string | null>(null);

  useEffect(() => {
    logMonetisationClientEvent("compare_view", null, "billing", {});
    logMonetisationClientEvent("compare_reco_view", null, "billing", { choice: recommendation.recommended });
  }, [recommendation.recommended]);

  const startSubscriptionCheckout = async (planKey: "monthly_30" | "monthly_80") => {
    setError(null);
    setRequestId(null);
    setSupportSnippet(null);
    try {
      const { headers, requestId: rid } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          mode: "subscription",
          planKey,
          returnTo: `${returnTo}?from=compare_reco&plan=${planKey}`,
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await safeReadJson<any>(response);
      const payloadError = (payload.data as any)?.error;
      const resolvedRequestId = payloadError?.requestId ?? response.headers.get("x-request-id") ?? rid ?? null;
      if (!response.ok || !(payload.data as any)?.url) {
        setError(payloadError?.message ?? ERROR_COPY.checkoutStart.message);
        if (resolvedRequestId) {
          setRequestId(resolvedRequestId);
          setSupportSnippet(
            buildSupportSnippet({
              action: "Start subscription checkout",
              path: returnTo,
              requestId: resolvedRequestId,
              code: payloadError?.code,
            })
          );
        }
        logMonetisationClientEvent("compare_checkout_fail", applicationId ?? null, "billing", {
          choice: "subscription",
          planKey,
          requestId: resolvedRequestId,
        });
        return;
      }
      logMonetisationClientEvent("compare_checkout_start", applicationId ?? null, "billing", {
        choice: "subscription",
        planKey,
        from: "compare_reco",
        requestId: resolvedRequestId,
      });
      window.location.href = (payload.data as any).url as string;
    } catch {
      setError(ERROR_COPY.checkoutStart.message);
      logMonetisationClientEvent("compare_checkout_fail", applicationId ?? null, "billing", {
        choice: "subscription",
        planKey,
        requestId: null,
      });
    }
  };

  const startTopupCheckout = async (packKey: CreditPack["key"]) => {
    setError(null);
    setRequestId(null);
    setSupportSnippet(null);
    try {
      const { headers, requestId: rid } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          packKey,
          returnTo: `${returnTo}?from=compare_reco&pack=${packKey}`,
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await safeReadJson<any>(response);
      const payloadError = (payload.data as any)?.error;
      const resolvedRequestId = payloadError?.requestId ?? response.headers.get("x-request-id") ?? rid ?? null;
      if (!response.ok || !(payload.data as any)?.url) {
        setError(payloadError?.message ?? ERROR_COPY.checkoutStart.message);
        if (resolvedRequestId) {
          setRequestId(resolvedRequestId);
          setSupportSnippet(
            buildSupportSnippet({
              action: "Start top-up checkout",
              path: returnTo,
              requestId: resolvedRequestId,
              code: payloadError?.code,
            })
          );
        }
        logMonetisationClientEvent("compare_checkout_fail", applicationId ?? null, "billing", {
          choice: "topup",
          packKey,
          requestId: resolvedRequestId,
        });
        return;
      }
      logMonetisationClientEvent("compare_checkout_start", applicationId ?? null, "billing", {
        choice: "topup",
        packKey,
        from: "compare_reco",
        requestId: resolvedRequestId,
      });
      window.location.href = (payload.data as any).url as string;
    } catch {
      setError(ERROR_COPY.checkoutStart.message);
      logMonetisationClientEvent("compare_checkout_fail", applicationId ?? null, "billing", {
        choice: "topup",
        packKey,
        requestId: null,
      });
    }
  };

  const handleManage = async () => {
    setError(null);
    setRequestId(null);
    setSupportSnippet(null);
    try {
      const { headers, requestId: rid } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const response = await fetch(`/api/stripe/portal?flow=manage&returnTo=${encodeURIComponent(returnTo)}`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      const payload = await safeReadJson<any>(response);
      const payloadError = (payload.data as any)?.error;
      const resolvedRequestId = payloadError?.requestId ?? response.headers.get("x-request-id") ?? rid ?? null;
      if (!response.ok || !(payload.data as any)?.url) {
        setError(payloadError?.message ?? ERROR_COPY.portalOpen.message);
        if (resolvedRequestId) {
          setRequestId(resolvedRequestId);
          setSupportSnippet(
            buildSupportSnippet({
              action: "Open Stripe portal",
              path: returnTo,
              requestId: resolvedRequestId,
              code: payloadError?.code,
            })
          );
        }
        logMonetisationClientEvent("compare_checkout_fail", applicationId ?? null, "billing", {
          choice: "subscription",
          requestId: resolvedRequestId,
        });
        return;
      }
      logMonetisationClientEvent("compare_portal_open", applicationId ?? null, "billing", { from: "compare_reco" });
      window.location.href = (payload.data as any).url as string;
    } catch {
      setError(ERROR_COPY.portalOpen.message);
    }
  };

  const handleSubscription = () => {
    const planKey = recommendation.recommendedPlanKey ?? "monthly_30";
    logMonetisationClientEvent("compare_reco_click", null, "billing", { choice: "subscription", planKey });
    if (hasSubscription) {
      handleManage();
      return;
    }
    startSubscriptionCheckout(planKey);
  };

  const handleTopup = () => {
    const packKey = recommendation.recommendedPackKey ?? "starter";
    logMonetisationClientEvent("compare_reco_click", null, "billing", { choice: "topup", packKey });
    startTopupCheckout(packKey);
  };

  const handleToggleWhy = () => {
    setShowWhy((prev) => !prev);
    logMonetisationClientEvent("compare_why_open", null, "billing", { open: !showWhy });
  };

  return (
    <div className="space-y-3 rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm">
      {error ? (
        <ErrorBanner
          title={ERROR_COPY.checkoutStart.title}
          message={error}
          requestId={requestId}
          supportSnippet={supportSnippet}
          onDismiss={() => setError(null)}
        />
      ) : null}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{COPY.title}</p>
        <p className="text-sm text-[rgb(var(--muted))]">{COPY.subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={`flex flex-col gap-3 rounded-2xl border ${isSubscriptionReco ? "border-indigo-200 bg-indigo-50/70" : "border-black/10 bg-white" } p-4`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">{COPY.subscription.title}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{COPY.subscription.tagline}</p>
            </div>
            {isSubscriptionReco ? (
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white">
                {COPY.recommended}
              </span>
            ) : null}
          </div>
          <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
            {COPY.subscription.bullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSubscription}
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!subscriptionAvailable || (recommendation.recommended === "topup" && !hasSubscription && !recommendation.recommendedPlanKey)}
            >
              {hasSubscription ? COPY.subscription.manage : COPY.subscription.cta}
              {recommendedPlan ? ` • ${recommendedPlan.name}` : ""}
            </button>
            {!isSubscriptionReco ? (
              <button
                type="button"
                className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                onClick={() => {
                  logMonetisationClientEvent("compare_option_switch", null, "billing", { choice: "subscription" });
                  startSubscriptionCheckout(recommendation.recommendedPlanKey ?? "monthly_30");
                }}
              >
                {COPY.secondary}
              </button>
            ) : null}
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {COPY.reasons[recommendation.variant] ?? COPY.reasons.weekly_momentum}
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
            onClick={handleToggleWhy}
          >
            {showWhy ? COPY.whyClose : COPY.whyOpen}
          </button>
          {showWhy ? (
            <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
              {recommendation.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div
          className={`flex flex-col gap-3 rounded-2xl border ${!isSubscriptionReco ? "border-indigo-200 bg-indigo-50/70" : "border-black/10 bg-white"} p-4`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">{COPY.topup.title}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{COPY.topup.tagline}</p>
            </div>
            {!isSubscriptionReco ? (
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white">
                {COPY.recommended}
              </span>
            ) : null}
          </div>
          <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
            {COPY.topup.bullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleTopup}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:opacity-50"
              disabled={!recommendedPack || packAvailability[recommendedPack?.key] === false}
            >
              {COPY.topup.cta}
              {recommendedPack ? ` • ${recommendedPack.credits} credits (${formatGbp(recommendedPack.priceGbp)})` : ""}
            </button>
            {isSubscriptionReco ? (
              <button
                type="button"
                className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                onClick={() => {
                  logMonetisationClientEvent("compare_option_switch", null, "billing", { choice: "topup" });
                  startTopupCheckout((recommendedPack?.key ?? "starter") as CreditPack["key"]);
                }}
              >
                {COPY.secondary}
              </button>
            ) : null}
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {!isSubscriptionReco ? (COPY.reasons[recommendation.variant] ?? COPY.reasons.single_push) : COPY.reasons.single_push}
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
            onClick={handleToggleWhy}
          >
            {showWhy ? COPY.whyClose : COPY.whyOpen}
          </button>
          {showWhy ? (
            <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
              {recommendation.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
