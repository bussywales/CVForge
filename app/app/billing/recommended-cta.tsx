"use client";

import { useState } from "react";
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

  const handleCheckout = async () => {
    setLoading(true);
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
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      className="w-full rounded-full bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow hover:bg-[rgb(var(--accent-strong))]"
      disabled={loading}
    >
      {loading ? "Starting checkout..." : `Top up ${priceLabel} (${packName})`}
    </button>
  );
}
