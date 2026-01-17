"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { portalSaveOfferDismissKey } from "@/lib/billing/portal-return";
import type { SaveOfferReco } from "@/lib/billing/sub-save-offer";

type Props = {
  weekKey: string;
  reco: SaveOfferReco;
  planKey: "monthly_30" | "monthly_80";
  applicationId?: string | null;
  returnTo?: string;
  show: boolean;
  onDismiss?: () => void;
};

export default function SubSaveOfferCard({
  weekKey,
  reco,
  planKey,
  applicationId,
  returnTo = "/app/billing",
  show,
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const key = portalSaveOfferDismissKey(weekKey);
    const dismissed = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!dismissed) {
      setVisible(true);
      logMonetisationClientEvent("sub_save_offer_view", applicationId ?? null, "billing", {
        flow: reco.portalFlow,
        plan: reco.portalPlan ?? planKey,
        variant: reco.variant,
      });
    }
  }, [applicationId, planKey, reco.portalFlow, reco.portalPlan, reco.variant, show, weekKey]);

  if (!visible) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(portalSaveOfferDismissKey(weekKey), "1");
    }
    setVisible(false);
    logMonetisationClientEvent("sub_save_offer_dismiss", applicationId ?? null, "billing", {
      flow: reco.portalFlow,
      plan: reco.portalPlan ?? planKey,
      variant: reco.variant,
    });
    onDismiss?.();
  };

  const openPortal = async (flow: string, plan?: "monthly_30" | "monthly_80") => {
    logMonetisationClientEvent("sub_save_offer_portal_open", applicationId ?? null, "billing", {
      flow,
      plan: plan ?? planKey,
      variant: reco.variant,
    });
    try {
      const url = `/api/stripe/portal?flow=${encodeURIComponent(flow)}${plan ? `&plan=${plan}` : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ returnTo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-900">
            Before you go — keep your momentum
          </p>
          <p className="text-xs text-amber-700">
            We’ll adjust your plan so you don’t lose progress.
          </p>
          {reco.reasons.length ? (
            <div className="flex flex-wrap gap-2">
              {reco.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-sm"
                >
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          onClick={() => {
            logMonetisationClientEvent("sub_save_offer_primary_click", applicationId ?? null, "billing", {
              flow: reco.portalFlow,
              plan: reco.portalPlan ?? planKey,
              variant: reco.variant,
            });
            openPortal(reco.portalFlow, reco.portalPlan ?? planKey);
          }}
        >
          {reco.primaryCtaLabel}
        </button>
        {reco.variant === "DOWNGRADE" && reco.secondaryCtaLabel ? (
          <button
            type="button"
            className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              logMonetisationClientEvent(
                "sub_save_offer_secondary_click",
                applicationId ?? null,
                "billing",
                { flow: "downgrade", plan: "monthly_30", variant: reco.variant }
              );
              openPortal("downgrade", "monthly_30");
            }}
          >
            {reco.secondaryCtaLabel}
          </button>
        ) : null}
        <Link
          href="/app/billing#packs"
          className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
          onClick={() =>
            logMonetisationClientEvent(
              "sub_save_offer_topups_click",
              applicationId ?? null,
              "billing",
              { flow: reco.portalFlow, plan: reco.portalPlan ?? planKey, variant: reco.variant }
            )
          }
        >
          Use top-ups instead
        </Link>
      </div>
    </div>
  );
}
