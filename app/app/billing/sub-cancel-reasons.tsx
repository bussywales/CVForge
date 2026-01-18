"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { portalReturnKey } from "@/lib/billing/portal-return";
import CancelDeflection from "./cancel-deflection";
import { BILLING_MICROCOPY } from "@/lib/billing/microcopy";

type ReasonKey = "expensive" | "low_usage" | "alternative" | "unsure" | "technical";

const REASONS: Array<{ key: ReasonKey; label: string }> = [
  { key: "expensive", label: "Too expensive right now" },
  { key: "low_usage", label: "Not using it enough" },
  { key: "alternative", label: "Found an alternative" },
  { key: "unsure", label: "Still deciding / not sure" },
  { key: "technical", label: "Technical issues" },
];

type Props = {
  weekKey: string;
  portalKey: string;
  state: { flow: string | null; plan: string | null };
  applicationId?: string | null;
  returnTo?: string;
  onContinue?: (reason: ReasonKey) => void;
};

export default function SubCancelReasons({
  weekKey,
  portalKey,
  state,
  applicationId,
  returnTo = "/app/billing",
}: Props) {
  const storageKey = `sub_cancel_reason_${weekKey}`;
  const [selected, setSelected] = useState<ReasonKey | null>(null);
  const [viewLogged, setViewLogged] = useState(false);
  const [showDeflect, setShowDeflect] = useState(false);

  useEffect(() => {
    const guardKey = `cvf:portalReturnLogged:${portalKey || weekKey}:cancel_reason`;
    const seen = typeof window !== "undefined" ? window.sessionStorage.getItem(guardKey) : null;
    if (!viewLogged && !seen) {
      logMonetisationClientEvent("sub_cancel_reason_view", applicationId ?? null, "billing", {
        flow: state.flow,
        plan: state.plan,
      });
      setViewLogged(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(guardKey, "1");
      }
    }
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(storageKey) as ReasonKey | null;
      if (saved) {
        setSelected(saved);
      }
    }
  }, [applicationId, portalKey, state.flow, state.plan, storageKey, viewLogged, weekKey]);

  const handleSelect = (key: ReasonKey) => {
    setSelected(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, key);
    }
    logMonetisationClientEvent("sub_cancel_reason_select", applicationId ?? null, "billing", {
      flow: state.flow,
      plan: state.plan,
      reasonKey: key,
    });
  };

  const openPortal = async () => {
    if (!selected) return;
    setShowDeflect(true);
    logMonetisationClientEvent("sub_cancel_reason_continue_portal", applicationId ?? null, "billing", {
      flow: state.flow,
      plan: state.plan,
      reasonKey: selected,
    });
    try {
      const flowParam = state.flow ?? "cancel";
      const planParam = state.plan ? `&plan=${state.plan}` : "";
      const response = await fetch(`/api/stripe/portal?flow=${encodeURIComponent(flowParam)}${planParam}`, {
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

  const dismiss = () => {
    logMonetisationClientEvent("sub_cancel_reason_dismiss", applicationId ?? null, "billing", {
      flow: state.flow,
      plan: state.plan,
      reasonKey: selected,
    });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {BILLING_MICROCOPY.cancelDeflection.reasonTitle}
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {BILLING_MICROCOPY.cancelDeflection.reasonHelper}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((reason) => (
          <button
            key={reason.key}
            type="button"
            onClick={() => handleSelect(reason.key)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${
              selected === reason.key
                ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-white"
                : "border-black/10 bg-white text-[rgb(var(--ink))] hover:bg-slate-50"
            }`}
          >
            {reason.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!selected}
          className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[rgb(var(--accent-strong))] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={openPortal}
        >
          {BILLING_MICROCOPY.cancelDeflection.secondaryCta}
        </button>
        <button
          type="button"
          className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          onClick={dismiss}
        >
          {BILLING_MICROCOPY.cancelDeflection.tertiaryCta}
        </button>
      </div>
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
        <p className="font-semibold">Before you go…</p>
        <p className="text-[11px] text-emerald-700">
          You may be able to switch plans or pause in the billing portal.
        </p>
        <button
          type="button"
          className="mt-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
          onClick={() => {
            logMonetisationClientEvent(
              "sub_cancel_pause_hint_click",
              applicationId ?? null,
              "billing",
              { flow: state.flow, plan: state.plan, portalKey }
            );
            openPortal();
          }}
        >
          See options in portal
        </button>
      </div>
      {showDeflect && selected ? (
        <div className="mt-3">
          <CancelDeflection
            planKey={(state.plan as "monthly_30" | "monthly_80") ?? "monthly_30"}
            weekKey={weekKey}
            flow={state.flow}
            planParam={state.plan}
            applicationId={applicationId}
            onOpenChange={(open) => setShowDeflect(open)}
          />
        </div>
      ) : null}
    </div>
  );
}
