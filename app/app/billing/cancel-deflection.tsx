"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { CancelReasonKey } from "@/lib/billing/cancel-deflect";
import { recommendCancelDeflect } from "@/lib/billing/cancel-deflect";
import { portalReturnKey } from "@/lib/billing/portal-return";
import { BILLING_MICROCOPY, formatCta } from "@/lib/billing/microcopy";

const REASONS: Array<{ key: CancelReasonKey; label: string }> = [
  { key: "expensive", label: "Too expensive right now" },
  { key: "low_usage", label: "Not using it enough" },
  { key: "alternative", label: "Found an alternative" },
  { key: "unsure", label: "Still deciding / not sure" },
  { key: "technical", label: "Technical issues" },
];

type Props = {
  planKey: "monthly_30" | "monthly_80";
  weekKey: string;
  flow: string | null;
  planParam: string | null;
  applicationId?: string | null;
  onOpenChange: (open: boolean) => void;
};

export default function CancelDeflection({
  planKey,
  weekKey,
  flow,
  planParam,
  applicationId,
  onOpenChange,
}: Props) {
  const [selected, setSelected] = useState<CancelReasonKey>("expensive");
  const [open, setOpen] = useState(true);
  const returnKey = portalReturnKey({ portal: true, flow, plan: planParam as any, ts: null }, weekKey);
  const dismissKey = `cancel_deflect_${weekKey}`;

  useEffect(() => {
    if (!open) return;
    const dismissed = typeof window !== "undefined" ? window.localStorage.getItem(dismissKey) : null;
    if (dismissed) {
      setOpen(false);
      onOpenChange(false);
      return;
    }
    const guardKey = `cvf:cancelDeflect:${returnKey}`;
    const seen = typeof window !== "undefined" ? window.sessionStorage.getItem(guardKey) : null;
    if (!seen) {
      logMonetisationClientEvent("cancel_deflect_view", applicationId ?? null, "billing", {
        flow,
        plan: planParam,
        weekKey,
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(guardKey, "1");
      }
    }
  }, [applicationId, dismissKey, flow, onOpenChange, open, planParam, returnKey, weekKey]);

  const reco = recommendCancelDeflect({ planKey, reason: selected });

  const openPortal = async (targetFlow: string, targetPlan?: string) => {
    logMonetisationClientEvent("cancel_deflect_save_click", applicationId ?? null, "billing", {
      flow: targetFlow,
      plan: targetPlan ?? planKey,
      offerKey: reco.offerKey,
      weekKey,
    });
    try {
      const plan = targetPlan ?? planKey;
      const response = await fetch(`/api/stripe/portal?flow=${encodeURIComponent(targetFlow)}&plan=${plan}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ returnTo: "/app/billing" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.url) {
        window.location.href = payload.url as string;
      }
    } catch {
      /* ignore */
    }
  };

  const dismiss = (event: "cancel_deflect_continue_to_stripe" | "cancel_deflect_not_now") => {
    logMonetisationClientEvent(event, applicationId ?? null, "billing", {
      flow,
      plan: planParam,
      weekKey,
    });
    setOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, "1");
    }
    onOpenChange(false);
  };

  if (!open) return null;

  const offerLabel =
    reco.offerKey === "downgrade"
      ? BILLING_MICROCOPY.cancelDeflection.downgradeLabel
      : reco.offerKey === "pause"
        ? BILLING_MICROCOPY.cancelDeflection.pauseLabel
        : BILLING_MICROCOPY.cancelDeflection.stayLabel;
  const offerDesc =
    reco.offerKey === "downgrade"
      ? BILLING_MICROCOPY.cancelDeflection.downgradeDesc
      : reco.offerKey === "pause"
        ? BILLING_MICROCOPY.cancelDeflection.pauseDesc
        : BILLING_MICROCOPY.cancelDeflection.stayDesc;

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">{BILLING_MICROCOPY.cancelDeflection.title}</p>
          <p className="text-xs text-amber-700">{BILLING_MICROCOPY.cancelDeflection.subtitle}</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
          onClick={() => {
            logMonetisationClientEvent("cancel_deflect_dismiss", applicationId ?? null, "billing", {
              flow,
              plan: planParam,
              weekKey,
            });
            dismiss("cancel_deflect_not_now");
          }}
        >
          {BILLING_MICROCOPY.cancelDeflection.tertiaryCta}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((reason) => (
          <button
            key={reason.key}
            type="button"
            onClick={() => {
              setSelected(reason.key);
              logMonetisationClientEvent("cancel_deflect_reason_select", applicationId ?? null, "billing", {
                reasonKey: reason.key,
                weekKey,
              });
            }}
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${
              selected === reason.key
                ? "border-amber-400 bg-amber-700 text-white"
                : "border-black/10 bg-white text-[rgb(var(--ink))] hover:bg-slate-50"
            }`}
          >
            {reason.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/60 bg-white p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          {BILLING_MICROCOPY.cancelDeflection.stepTitle}
        </p>
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">
          {formatCta(BILLING_MICROCOPY.cancelDeflection.primaryCtaTemplate, { offerLabel })}
        </p>
        <p className="text-[11px] text-[rgb(var(--muted))]">
          {BILLING_MICROCOPY.cancelDeflection.stepSubtitle}
        </p>
        <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">{offerDesc}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            onClick={() => {
              logMonetisationClientEvent("cancel_deflect_offer_shown", applicationId ?? null, "billing", {
                offerKey: reco.offerKey,
                flow: reco.flow,
                plan: reco.planTarget ?? planKey,
                weekKey,
              });
              openPortal(reco.flow, reco.planTarget);
            }}
          >
            {formatCta(BILLING_MICROCOPY.cancelDeflection.primaryCtaTemplate, { offerLabel })}
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              dismiss("cancel_deflect_continue_to_stripe");
              openPortal(flow ?? "cancel", planParam ?? planKey);
            }}
          >
            {BILLING_MICROCOPY.cancelDeflection.secondaryCta}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">
          {BILLING_MICROCOPY.cancelDeflection.trust} {BILLING_MICROCOPY.cancelDeflection.dismissCopy}
        </p>
      </div>
    </div>
  );
}
