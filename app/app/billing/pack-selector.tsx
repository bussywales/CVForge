"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKS, formatGbp, type CreditPack } from "@/lib/billing/packs-data";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import ErrorBanner from "@/components/ErrorBanner";
import { withRequestIdHeaders } from "@/lib/observability/request-id";
import { safeReadJson } from "@/lib/http/safe-json";
import { ERROR_COPY } from "@/lib/microcopy/errors";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

type Props = {
  contextLabel?: string;
  returnTo?: string;
  compact?: boolean;
  onPurchasedHint?: string;
  applicationId?: string;
  recommendedPackKey?: CreditPack["key"];
  packs?: CreditPack[];
  compactCards?: boolean;
  surface?: "billing" | "insights" | "apply" | "interview" | "gate";
  packAvailability?: Partial<Record<CreditPack["key"], boolean>>;
};

type CheckoutState = {
  status: "idle" | "loading" | "error";
  packKey?: CreditPack["key"] | null;
  message?: string;
  requestId?: string | null;
  supportSnippet?: string | null;
};

function PackCard({
  pack,
  onSelect,
  compact,
  available,
  surface,
  applicationId,
  isLoading,
}: {
  pack: CreditPack;
  onSelect: (key: CreditPack["key"]) => void;
  compact?: boolean;
  available?: boolean;
  surface: Props["surface"];
  applicationId?: string;
  isLoading?: boolean;
}) {
  const unavailable = available === false;

  useEffect(() => {
    if (!unavailable) return;
    logMonetisationClientEvent("billing_pack_unavailable", applicationId, surface, {
      packKey: pack.key,
    });
  }, [applicationId, pack.key, surface, unavailable]);

  return (
    <div
      className={`flex flex-1 flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 shadow-sm ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {pack.name}
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {pack.credits} credits · {formatGbp(pack.priceGbp)}
          </p>
        </div>
        {pack.badge ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
            {pack.badge}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-[rgb(var(--muted))]">{pack.description}</p>
      <button
        type="button"
        onClick={() => onSelect(pack.key)}
        className={`inline-flex items-center justify-center rounded-full border border-black/10 bg-[rgb(var(--ink))] text-sm font-semibold text-white hover:bg-black ${
          compact ? "px-3 py-2" : "px-4 py-2"
        }`}
            disabled={unavailable || isLoading}
      >
        {isLoading ? "Starting checkout..." : `Buy ${pack.credits} credits`}
      </button>
      {unavailable ? (
        <p className="text-xs text-amber-700">This pack isn’t available right now.</p>
      ) : null}
    </div>
  );
}

export default function PackSelector({
  contextLabel,
  returnTo,
  compact,
  onPurchasedHint,
  applicationId,
  recommendedPackKey,
  packs,
  compactCards,
  surface = "billing",
  packAvailability,
}: Props) {
  const [state, setState] = useState<CheckoutState>({ status: "idle", packKey: null });
  const [redirectIssue, setRedirectIssue] = useState(false);

  const startCheckout = async (packKey: CreditPack["key"]) => {
    const available = packAvailability?.[packKey] ?? true;
    if (!available) {
      logMonetisationClientEvent("billing_pack_unavailable", applicationId, surface, {
        packKey,
      });
      setState({
        status: "error",
        packKey,
        message: "Pack unavailable.",
      });
      return;
    }
    setRedirectIssue(false);
    setState({ status: "loading", packKey });
    if (applicationId) {
      logMonetisationClientEvent("checkout_started", applicationId, surface, {
        packKey,
      });
    }
    try {
      const { headers, requestId } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ packKey, returnTo, applicationId }),
      });
      const payload = await safeReadJson(response);
      const payloadError = (payload.data as any)?.error;
      const requestIdFromHeader = response.headers.get("x-request-id");
      const resolvedRequestId = payloadError?.requestId ?? requestIdFromHeader ?? requestId ?? null;
      const redirectUrl = (payload.data as any)?.url;
      if (!response.ok || !redirectUrl) {
        logMonetisationClientEvent("checkout_start_failed", applicationId, surface, {
          packKey,
          status: response.status,
        });
        setState({
          status: "error",
          packKey,
          message: payloadError?.message ?? payloadError ?? "Unable to start checkout.",
          requestId: resolvedRequestId,
          supportSnippet: resolvedRequestId
            ? buildSupportSnippet({
                action: "Start checkout",
                path: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/app/billing",
                requestId: resolvedRequestId,
                code: payloadError?.code,
              })
            : null,
        });
        return;
      }
      const timer = window.setTimeout(() => {
        setRedirectIssue(true);
        logMonetisationClientEvent(
          "checkout_redirect_blocked",
          applicationId,
          surface,
          { packKey }
        );
      }, 2000);
      window.location.href = redirectUrl as string;
      window.setTimeout(() => window.clearTimeout(timer), 2500);
    } catch (error) {
      logMonetisationClientEvent("checkout_start_failed", applicationId, surface, {
        packKey,
        status: "network_error",
      });
      setState({
        status: "error",
        packKey,
        message: "Unable to start checkout.",
      });
    }
  };

  return (
    <div className="space-y-3">
      {state.status === "error" ? (
        <ErrorBanner
          title={ERROR_COPY.checkoutStart.title}
          message={state.message ?? ERROR_COPY.checkoutStart.message}
          hint={ERROR_COPY.checkoutStart.hint}
          requestId={state.requestId}
          supportSnippet={state.supportSnippet}
          onRetry={() => state.packKey && startCheckout(state.packKey)}
          onDismiss={() => setState({ status: "idle", packKey: null })}
        />
      ) : null}
      {contextLabel ? (
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">
          Top up to continue — {contextLabel}
        </p>
      ) : null}
      <div
        className={`flex w-full gap-3 ${
          compact ? "flex-col md:flex-row" : "flex-col lg:flex-row"
        }`}
      >
        {[...(packs ?? CREDIT_PACKS)]
          .sort((a, b) => {
            if (!recommendedPackKey) return 0;
            if (a.key === recommendedPackKey) return -1;
            if (b.key === recommendedPackKey) return 1;
            return 0;
          })
          .map((pack) => (
          <PackCard
            key={pack.key}
            pack={pack}
            onSelect={startCheckout}
            compact={compactCards}
            available={packAvailability?.[pack.key] ?? true}
            surface={surface}
            applicationId={applicationId}
            isLoading={state.status === "loading" && state.packKey === pack.key}
          />
        ))}
      </div>
      {onPurchasedHint ? (
        <p className="text-xs text-[rgb(var(--muted))]">{onPurchasedHint}</p>
      ) : null}
      {state.status === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Checkout couldn’t start.</p>
          <p className="text-xs text-amber-700">
            Please try again. If it keeps happening, choose another pack or try again in a moment.
            {state.message ? ` (${state.message})` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
              onClick={() => {
                if (state.packKey) {
                  logMonetisationClientEvent(
                    "checkout_try_again",
                    applicationId,
                    surface,
                    { packKey: state.packKey }
                  );
                  startCheckout(state.packKey);
                } else {
                  setState({ status: "idle", packKey: null });
                }
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => {
                setState({ status: "idle", packKey: null });
                setRedirectIssue(false);
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => {
                logMonetisationClientEvent(
                  "checkout_open_new_tab",
                  applicationId,
                  surface,
                  { packKey: state.packKey }
                );
                window.open("/app/billing", "_blank");
              }}
            >
              Open billing
            </button>
          </div>
          {redirectIssue ? (
            <p className="mt-2 text-xs text-amber-700">
              If nothing opened, your browser may be blocking redirects.
            </p>
          ) : null}
        </div>
      ) : null}
      {redirectIssue ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">
            If nothing opened, your browser may be blocking redirects.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
              onClick={() => {
                if (state.packKey) {
                  logMonetisationClientEvent(
                    "checkout_try_again",
                    applicationId,
                    surface,
                    { packKey: state.packKey }
                  );
                  startCheckout(state.packKey);
                } else {
                  setRedirectIssue(false);
                }
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => {
                logMonetisationClientEvent(
                  "checkout_open_new_tab",
                  applicationId,
                  surface,
                  { packKey: state.packKey }
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
