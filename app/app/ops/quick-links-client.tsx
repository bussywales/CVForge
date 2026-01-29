"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { RagStatus } from "@/lib/ops/rag-status";

export default function QuickLinksClient() {
  const [rag, setRag] = useState<RagStatus | null>(null);

  const focusSearch = () => {
    if (typeof window === "undefined") return;
    const event = new CustomEvent("ops-focus-user-lookup");
    window.dispatchEvent(event);
    const el = document.getElementById("ops-user-lookup");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    const fetchRag = async () => {
      try {
        const res = await fetch("/api/ops/system-status", { method: "GET", cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (body?.ok && body.status?.rag) {
          setRag(body.status.rag);
        }
      } catch {
        // swallow
      }
    };
    fetchRag();
  }, []);

  const ragPill = rag ? (
    <Link
      href="/app/ops/status#rag"
      onClick={() => logMonetisationClientEvent("ops_status_rag_action_click", null, "ops", { actionKey: "status_rag", overall: rag.status ?? rag.overall })}
      className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor:
          (rag.status ?? rag.overall) === "green"
            ? "rgba(16,185,129,0.15)"
            : (rag.status ?? rag.overall) === "amber"
              ? "rgba(251,191,36,0.2)"
              : "rgba(248,113,113,0.2)",
        color: (rag.status ?? rag.overall) === "green" ? "#065f46" : (rag.status ?? rag.overall) === "amber" ? "#92400e" : "#991b1b",
      }}
    >
      {(rag.status ?? rag.overall).toUpperCase()}
    </Link>
  ) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Link
        href="/app/ops/incidents"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Open Incidents
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Request ID lookup & recent errors</p>
      </Link>
      <button
        type="button"
        onClick={focusSearch}
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        User lookup
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Search by email or user id</p>
      </button>
      <Link
        href="/app/ops/audits"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Audits
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Review ops actions with filters/export</p>
      </Link>
      <Link
        href="/app/ops/activation"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Activation funnel
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Aggregated activation signals (ops-only)</p>
      </Link>
      <Link
        href="/app/ops/resolutions"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Resolutions
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Outcome analytics & watchlist</p>
      </Link>
      <Link
        href="/app/ops/webhooks"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Webhooks
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Stripe webhook failures (read-only)</p>
      </Link>
      <Link
        href="/app/ops/status"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        System status
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">
          Ops view of core health (24h) {ragPill}
        </p>
      </Link>
      <Link
        href="/app/ops/alerts"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Alerts
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">15m thresholds + webhook notify</p>
      </Link>
      <Link
        href="/app/ops/case"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Case View
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">RequestId-first support cockpit</p>
      </Link>
      <Link
        href="/app/ops/help"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Help
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Ops runbook + escalation guidance</p>
      </Link>
      <Link
        href="/app/ops/access"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Access
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Manage early access allowlist (ops)</p>
      </Link>
    </div>
  );
}
