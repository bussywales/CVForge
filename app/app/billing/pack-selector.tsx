"use client";

import { useState } from "react";
import { CREDIT_PACKS, formatGbp, type CreditPack } from "@/lib/billing/packs";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  contextLabel?: string;
  returnTo?: string;
  compact?: boolean;
  onPurchasedHint?: string;
  applicationId?: string;
  recommendedPackKey?: CreditPack["key"];
};

type CheckoutState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

function PackCard({
  pack,
  onSelect,
}: {
  pack: CreditPack;
  onSelect: (key: CreditPack["key"]) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
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
        className="inline-flex items-center justify-center rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
      >
        Buy {pack.credits} credits
      </button>
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
}: Props) {
  const [state, setState] = useState<CheckoutState>({ status: "idle" });

  const startCheckout = async (packKey: CreditPack["key"]) => {
    setState({ status: "loading" });
    if (applicationId) {
      logMonetisationClientEvent("checkout_started", applicationId, "billing", {
        packKey,
      });
    }
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packKey, returnTo, applicationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        setState({
          status: "error",
          message: payload?.error ?? "Unable to start checkout.",
        });
        return;
      }
      window.location.href = payload.url as string;
    } catch (error) {
      setState({
        status: "error",
        message: "Unable to start checkout.",
      });
    }
  };

  return (
    <div className="space-y-3">
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
        {[...CREDIT_PACKS]
          .sort((a, b) => {
            if (!recommendedPackKey) return 0;
            if (a.key === recommendedPackKey) return -1;
            if (b.key === recommendedPackKey) return 1;
            return 0;
          })
          .map((pack) => (
          <PackCard key={pack.key} pack={pack} onSelect={startCheckout} />
        ))}
      </div>
      {onPurchasedHint ? (
        <p className="text-xs text-[rgb(var(--muted))]">{onPurchasedHint}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
