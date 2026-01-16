"use client";

import { useEffect, useState } from "react";

type Diagnostics = {
  hasStarter: boolean;
  hasPro: boolean;
  hasPower: boolean;
  hasSub30: boolean;
  hasSub80: boolean;
  hasStripeSecret: boolean;
  siteUrl: string | null;
  deploymentHint: "production" | "preview" | "unknown";
};

type Props = {
  show: boolean;
};

export default function BillingDiagnostics({ show }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data || error) return;
    fetch("/api/billing/diagnostics", { credentials: "include" })
      .then((res) => res.json())
      .then((payload) => setData(payload as Diagnostics))
      .catch(() => setError("Unable to load diagnostics."));
  }, [open, data, error]);

  if (!show) return null;

  const missing: string[] = [];
  if (data) {
    if (!data.hasStarter) missing.push("STRIPE_PACK_STARTER_PRICE_ID");
    if (!data.hasPro) missing.push("STRIPE_PACK_PRO_PRICE_ID");
    if (!data.hasPower) missing.push("STRIPE_PACK_POWER_PRICE_ID");
    if (!data.hasSub30) missing.push("STRIPE_SUB_MONTHLY_30_PRICE_ID");
    if (!data.hasSub80) missing.push("STRIPE_SUB_MONTHLY_80_PRICE_ID");
    if (!data.hasStripeSecret) missing.push("STRIPE_SECRET_KEY");
    if (!data.siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");
  }

  return (
    <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-3 text-xs text-[rgb(var(--muted))]">
      <button
        type="button"
        className="text-[rgb(var(--ink))] underline-offset-2 hover:underline"
        onClick={() => setOpen((prev) => !prev)}
      >
        Diagnostics
      </button>
      {open ? (
        <div className="mt-2 space-y-1">
          {error ? <p className="text-red-600">{error}</p> : null}
          {data ? (
            <>
              {missing.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-semibold text-[rgb(var(--ink))]">
                    Billing config missing on this deployment
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    If you just updated Vercel env vars, redeploy this environment
                    ({data.deploymentHint}).
                  </p>
                </div>
              ) : (
                <p>All required billing env vars are present.</p>
              )}
            </>
          ) : (
            <p>Loading…</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
