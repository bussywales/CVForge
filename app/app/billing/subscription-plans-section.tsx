"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SubscriptionPlanSelector from "./subscription-plan-selector";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/billing/plans-data";
import { formatGbp } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import CompareCard from "./compare-card";
import type { CompareResult } from "@/lib/billing/compare";
import { withRequestIdHeaders } from "@/lib/observability/request-id";
import { safeReadJson } from "@/lib/http/safe-json";
import ErrorBanner from "@/components/ErrorBanner";
import { ERROR_COPY } from "@/lib/microcopy/errors";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import { buildPortalLink } from "@/lib/billing/portal-link";

type PlanKey = "monthly_30" | "monthly_80";

type Props = {
  applicationId: string | null;
  recommendedPlanKey: PlanKey;
  initialPlanKey?: PlanKey | null;
  reasonChips: string[];
  planAvailability: { monthly_30?: boolean; monthly_80?: boolean };
  hasSubscription: boolean;
  currentPlanKey: PlanKey | null;
  canManageInPortal: boolean;
  returnTo: string;
  comparison: CompareResult;
  recommendedPack: { key: string; name: string; priceGbp: number };
  packAvailable: boolean;
  fromStreakSaver?: boolean;
};

export default function SubscriptionPlansSection({
  applicationId,
  recommendedPlanKey,
  initialPlanKey,
  reasonChips,
  planAvailability,
  hasSubscription,
  currentPlanKey,
  canManageInPortal,
  returnTo,
  comparison,
  recommendedPack,
  packAvailable,
  fromStreakSaver = false,
}: Props) {
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>(initialPlanKey ?? recommendedPlanKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [supportSnippet, setSupportSnippet] = useState<string | null>(null);
  const reasonLogged = useRef(false);
  const manageLogged = useRef(false);

  const sendPortalClick = (flow: string, planKey?: PlanKey | null) => {
    const payload = {
      event: "billing_portal_click",
      applicationId: applicationId ?? null,
      surface: "billing",
      meta: { flow, planKey: planKey ?? selectedPlanKey, mode: "navigation", destination: "portal" },
    };
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/monetisation/log", JSON.stringify(payload));
      } else {
        fetch("/api/monetisation/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  };

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

  const handlePlanChange = (planKey: PlanKey) => {
    setSelectedPlanKey(planKey);
    if (fromStreakSaver) {
      logMonetisationClientEvent("streak_saver_plan_selected", applicationId ?? null, "billing", {
        planKey,
      });
    }
  };

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
    setRequestId(null);
    setSupportSnippet(null);
    logMonetisationClientEvent("sub_selector_start_checkout", applicationId ?? null, "billing", {
      planKey: selectedPlanKey,
    });
    if (fromStreakSaver) {
      logMonetisationClientEvent("streak_saver_checkout_start", applicationId ?? null, "billing", {
        planKey: selectedPlanKey,
      });
    }
    try {
      const returnToUrl =
        fromStreakSaver && returnTo.startsWith("/app/billing")
          ? `/app/billing?from=streak_saver&plan=${selectedPlanKey}`
          : returnTo;
      const { headers, requestId: generatedId } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          mode: "subscription",
          planKey: selectedPlanKey,
          returnTo: returnToUrl,
          applicationId: applicationId ?? undefined,
        }),
      });
      const payload = await safeReadJson(response);
      const payloadError = (payload.data as any)?.error;
      const resolvedRequestId = payloadError?.requestId ?? response.headers.get("x-request-id") ?? generatedId ?? null;
      if (resolvedRequestId) setRequestId(resolvedRequestId);
      if (response.ok && (payload.data as any)?.url) {
        window.location.href = (payload.data as any)?.url as string;
        return;
      }
      setError(payloadError?.message ?? ERROR_COPY.checkoutStart.message);
      if (resolvedRequestId) {
        setSupportSnippet(
          buildSupportSnippet({
            action: "Start checkout",
            path: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/app/billing",
            requestId: resolvedRequestId,
            code: payloadError?.code,
          })
        );
      }
      if (fromStreakSaver) {
        const reason =
          payloadError?.code === "MISSING_SUBSCRIPTION_PRICE_ID"
            ? "missing_price_id"
            : response.ok
              ? "unknown"
              : `http_${response.status}`;
        logMonetisationClientEvent(
          "streak_saver_checkout_start_failed",
          applicationId ?? null,
          "billing",
          {
            planKey: selectedPlanKey,
            reason,
            requestId: resolvedRequestId,
          }
        );
      }
    } catch {
      setError("We couldn’t start checkout. Please try again.");
      if (fromStreakSaver) {
        logMonetisationClientEvent(
          "streak_saver_checkout_start_failed",
          applicationId ?? null,
          "billing",
          {
            planKey: selectedPlanKey,
            reason: "network_error",
            requestId: null,
          }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    // deprecated
  };

  const renderManageActions = () => {
    if (!hasSubscription) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {currentPlanKey === "monthly_30" && planAvailability.monthly_80 ? (
          <a
            href={buildPortalLink({ flow: "upgrade_80", returnTo })}
            onClick={() => {
              logMonetisationClientEvent("sub_upgrade_click", applicationId ?? null, "billing", { from: currentPlanKey, to: "monthly_80" });
              sendPortalClick("upgrade_80", "monthly_80");
            }}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          >
            Upgrade to Monthly 80
          </a>
        ) : null}
        {currentPlanKey === "monthly_80" && planAvailability.monthly_30 ? (
          <a
            href={buildPortalLink({ flow: "downgrade_30", returnTo })}
            onClick={() => {
              logMonetisationClientEvent("sub_downgrade_click", applicationId ?? null, "billing", { from: currentPlanKey, to: "monthly_30" });
              sendPortalClick("downgrade_30", "monthly_30");
            }}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          >
            Downgrade to Monthly 30
          </a>
        ) : null}
        {canManageInPortal ? (
          <a
            href={buildPortalLink({ flow: "manage", returnTo })}
            onClick={() => {
              logMonetisationClientEvent("sub_selector_manage_portal_click", applicationId ?? null, "billing", { planKey: selectedPlanKey });
              sendPortalClick("manage", selectedPlanKey);
            }}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          >
            Manage in Stripe
          </a>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm">
      {error ? (
        <ErrorBanner
          title={error?.toLowerCase().includes("portal") ? ERROR_COPY.portalOpen.title : ERROR_COPY.checkoutStart.title}
          message={error}
          requestId={requestId}
          supportSnippet={supportSnippet}
          onRetry={
            error?.toLowerCase().includes("portal")
              ? () => handleManage()
              : () => handleCheckout()
          }
          onDismiss={() => setError(null)}
        />
      ) : null}
      <SubscriptionPlanSelector
        selectedPlanKey={selectedPlanKey}
        recommendedPlanKey={recommendedPlanKey}
        onChange={handlePlanChange}
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
      {error ? (
        <div className="text-xs text-amber-700">
          <p>{error}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
              onClick={() => {
                logMonetisationClientEvent(
                  "checkout_try_again",
                  applicationId ?? null,
                  "billing",
                  { planKey: selectedPlanKey }
                );
                handleCheckout();
              }}
              disabled={loading}
            >
              Retry checkout
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => {
                logMonetisationClientEvent(
                  "checkout_open_new_tab",
                  applicationId ?? null,
                  "billing",
                  { planKey: selectedPlanKey }
                );
                window.open("/app/billing", "_blank");
              }}
            >
              Open billing
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
