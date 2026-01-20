"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { RetentionSummary } from "@/lib/subscription-retention";
import { buildPortalLink } from "@/lib/billing/portal-link";

type PlanKey = "monthly_30" | "monthly_80";

type Action = {
  label: string;
  href: string;
  why?: string;
  applicationId?: string;
};

type Props = {
  planKey: PlanKey;
  summary: RetentionSummary;
  actions: Action[];
  latestApplicationId?: string | null;
  returnTo: string;
};

export default function SubscriptionHome({
  planKey,
  summary,
  actions,
  latestApplicationId,
  returnTo,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const primaryAction = useMemo(() => actions[0], [actions]);

  useEffect(() => {
    const appId = primaryAction?.applicationId ?? latestApplicationId ?? null;
    logMonetisationClientEvent("sub_home_view", appId, "billing", {
      planKey,
      risk: summary.risk,
    });
  }, [latestApplicationId, planKey, primaryAction?.applicationId, summary.risk]);

  const riskLabel =
    summary.risk === "high"
      ? "At risk"
      : summary.risk === "medium"
        ? "Keep momentum"
        : "On track";

  const riskTone =
    summary.risk === "high"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : summary.risk === "medium"
        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
        : "bg-emerald-100 text-emerald-800 border-emerald-200";

  const handlePortal = (flow?: string, meta?: Record<string, any>) => {
    const appId = primaryAction?.applicationId ?? latestApplicationId ?? null;
    logMonetisationClientEvent("sub_home_cta_click", appId, "billing", {
      flow: flow ?? "manage",
      planKey,
      ...meta,
    });
    const href = buildPortalLink({ flow: flow ?? "manage", returnTo });
    try {
      const payload = { event: "billing_portal_click", applicationId: appId, surface: "billing", meta: { flow, planKey, mode: "navigation", destination: "portal" } };
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/monetisation/log", JSON.stringify(payload));
      } else {
        fetch("/api/monetisation/log", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    window.location.assign(href);
  };

  const handleSavePlan = (target: PlanKey | undefined) => {
    const appId = primaryAction?.applicationId ?? latestApplicationId ?? null;
    if (!target) {
      setSaveOpen(false);
      return;
    }
    logMonetisationClientEvent("sub_save_offer_choose_plan", appId, "billing", {
      from: planKey,
      to: target,
    });
    handlePortal("cancel_save_offer", { to: target });
  };

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Your subscription this week
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            Plan: {planKey === "monthly_80" ? "Monthly 80" : "Monthly 30"}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${riskTone}`}>
          {riskLabel}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Stat label="Credits used" value={summary.creditsUsed} />
        <Stat label="Applications moved forward" value={summary.movedForward} />
        <Stat label="Streak" value={summary.streak} />
        <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3 text-sm text-[rgb(var(--ink))]">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Next week preview
          </p>
          <p className="mt-1 font-semibold">
            Keep your momentum: {(summary.movedForward || summary.completions || 1) + 2} actions next week
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            We’ll carry over your focus list.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/60 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Next best steps</p>
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="rounded-full bg-[rgb(var(--accent))] px-3 py-1 text-xs font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
              onClick={() =>
                logMonetisationClientEvent(
                  "sub_home_cta_click",
                  primaryAction.applicationId ?? latestApplicationId ?? null,
                  "billing",
                  { action: "primary", target: primaryAction.label }
                )
              }
            >
              {summary.recommendedSaveAction}
            </Link>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {actions.slice(0, 3).map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border border-black/10 bg-slate-50 p-3 text-xs text-[rgb(var(--ink))] hover:border-[rgb(var(--accent))]"
              onClick={() =>
                logMonetisationClientEvent(
                  "sub_home_cta_click",
                  action.applicationId ?? latestApplicationId ?? null,
                  "billing",
                  { action: "step", target: action.label }
                )
              }
            >
              <p className="font-semibold">{action.label}</p>
              {action.why ? <p className="text-[11px] text-[rgb(var(--muted))]">{action.why}</p> : null}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-4">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Thinking of cancelling?</p>
          <p className="text-xs text-[rgb(var(--muted))]">
            Most people cancel after a slow week. Want a lighter plan instead?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-emerald-50"
            onClick={() => setSaveOpen((prev) => {
              const next = !prev;
              if (next) {
                logMonetisationClientEvent(
                  "sub_save_offer_open",
                  primaryAction?.applicationId ?? latestApplicationId ?? null,
                  "billing",
                  { planKey }
                );
              }
              return next;
            })}
          >
            Thinking of cancelling?
          </button>
          <a
            href={buildPortalLink({ flow: "manage", returnTo })}
            className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-[rgb(var(--ink))]"
            onClick={() => handlePortal("manage")}
          >
            Manage in Stripe
          </a>
        </div>
      </div>

      {saveOpen ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">Before you cancel</p>
              <p className="text-xs text-amber-700">
                Most people cancel after a slow week. Want a plan that fits your pace?
              </p>
              {summary.saveOffer.reasonBullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-700">
                  {summary.saveOffer.reasonBullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {summary.saveOffer.show && summary.saveOffer.suggestedPlanKey ? (
                <button
                  type="button"
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                  onClick={() => handleSavePlan(summary.saveOffer.suggestedPlanKey)}
                >
                  Switch plan
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  setSaveOpen(false);
                  logMonetisationClientEvent(
                    "sub_save_offer_keep",
                    primaryAction?.applicationId ?? latestApplicationId ?? null,
                    "billing",
                    { planKey }
                  );
                }}
              >
                Keep plan
              </button>
              <a
                href={buildPortalLink({ flow: "cancel_save_offer", returnTo })}
                className="rounded-full border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  logMonetisationClientEvent(
                    "sub_save_offer_go_to_stripe",
                    primaryAction?.applicationId ?? latestApplicationId ?? null,
                    "billing",
                    { planKey }
                  );
                  handlePortal("cancel_save_offer", { intent: "cancel" });
                }}
              >
                Continue to Stripe
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[rgb(var(--ink))]">{value}</p>
    </div>
  );
}
