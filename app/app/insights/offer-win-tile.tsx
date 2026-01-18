"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { OfferWinCandidate } from "@/lib/offer-win-loop";

type Props = {
  candidate: OfferWinCandidate;
  weekKey: string;
};

export default function OfferWinTile({ candidate, weekKey }: Props) {
  const dismissKey = useMemo(() => `cvf:offer-win-dismissed:${weekKey}`, [weekKey]);
  const [dismissed, setDismissed] = useState(false);
  const [viewLogged, setViewLogged] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dismissKey) === "true") {
      setDismissed(true);
    }
  }, [dismissKey]);

  useEffect(() => {
    if (!dismissed && !viewLogged) {
      logMonetisationClientEvent("offer_win_tile_view", candidate.applicationId, "insights");
      setViewLogged(true);
    }
  }, [candidate.applicationId, dismissed, viewLogged]);

  if (dismissed) return null;

  return (
    <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Offer Win Loop</p>
          <p className="text-sm text-[rgb(var(--muted))]">Finish this in 10 minutes: counter → send → log → close-out.</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          onClick={() => {
            setDismissed(true);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(dismissKey, "true");
            }
            logMonetisationClientEvent("offer_win_tile_dismiss", candidate.applicationId, "insights");
          }}
        >
          Not now
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 p-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {candidate.role} · {candidate.company}
          </p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {candidate.status.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={candidate.primaryHref}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
            onClick={() =>
              logMonetisationClientEvent("offer_win_tile_open_offer_pack", candidate.applicationId, "insights")
            }
          >
            Open Offer Pack
          </Link>
          <Link
            href={`/app/applications/${candidate.applicationId}?tab=overview#outcome`}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
            onClick={() =>
              logMonetisationClientEvent("offer_win_tile_log_outcome", candidate.applicationId, "insights")
            }
          >
            Log outcome
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {candidate.steps.map((step) => (
          <div
            key={step.key}
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-[rgb(var(--muted))]"
          >
            <span>{step.label}</span>
            <Link
              href={step.href}
              className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
              onClick={() =>
                logMonetisationClientEvent("offer_win_tile_step_click", candidate.applicationId, "insights", {
                  step: step.key,
                })
              }
            >
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
