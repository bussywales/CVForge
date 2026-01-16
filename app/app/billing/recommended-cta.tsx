"use client";

import { useEffect, useState } from "react";
import { resolvePriceIdForPack } from "@/lib/billing/packs";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  packKey: string;
  priceLabel: string;
  packName: string;
  applicationId: string | null;
  returnTo: string;
};

export default function RecommendedCta({
  packKey,
  priceLabel,
  packName,
  applicationId,
  returnTo,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priceId = resolvePriceIdForPack(packKey);
  const unavailable = !priceId;

  useEffect(() => {
    if (!unavailable) return;
    logMonetisationClientEvent("billing_pack_unavailable", applicationId ?? null, "billing", {
      packKey,
    });
  }, [applicationId, packKey, unavailable]);

  const handleCheckout = async () => {
    if (unavailable) {
      logMonetisationClientEvent("billing_pack_unavailable", applicationId ?? null, "billing", {
        packKey,
      });
      setError("This pack isn’t available right now.");
      return;
    }
    setLoading(true);
    setError(null);
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
        body: JSON.stringify({ packKey, returnTo, applicationId: applicationId ?? undefined }),
      });
        const payload = await response.json().catch(() => ({}));
        if (payload?.url) {
          window.location.href = payload.url as string;
          return;
        }
        logMonetisationClientEvent("checkout_start_failed", applicationId ?? null, "billing", {
          packKey,
          status: response.status,
        });
      } catch {
        logMonetisationClientEvent("checkout_start_failed", applicationId ?? null, "billing", {
          packKey,
          status: "network_error",
        });
      }
      setError("Checkout couldn’t start. Please try again.");
      setLoading(false);
    };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCheckout}
        className="w-full rounded-full bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow hover:bg-[rgb(var(--accent-strong))] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || unavailable}
      >
        {unavailable
          ? "Pack unavailable"
          : loading
            ? "Starting checkout..."
            : `Top up ${priceLabel} (${packName})`}
      </button>
      {unavailable ? (
        <p className="text-xs text-amber-700">This pack isn’t available right now.</p>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Checkout couldn’t start.</p>
          <p className="text-xs text-amber-700">
            Please try again. If it keeps happening, choose another pack or try again in a moment.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
              onClick={handleCheckout}
              disabled={loading || unavailable}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
