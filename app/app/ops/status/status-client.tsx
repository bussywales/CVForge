"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { SystemStatus } from "@/lib/ops/system-status";

type Props = {
  initialStatus: SystemStatus;
  requestId: string | null;
};

export default function SystemStatusClient({ initialStatus, requestId }: Props) {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);

  useEffect(() => {
    logMonetisationClientEvent("ops_system_status_view", null, "ops");
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    logMonetisationClientEvent("ops_system_status_refresh_click", null, "ops");
    try {
      const res = await fetch("/api/ops/system-status", { method: "GET", cache: "no-store" });
      const body = await res.json();
      if (!body?.ok) {
        setError({ message: body?.error?.message ?? "Unable to refresh", requestId: body?.error?.requestId ?? null });
        setLoading(false);
        return;
      }
      setStatus(body.status);
      setLoading(false);
    } catch {
      setError({ message: "Unable to refresh", requestId: null });
      setLoading(false);
    }
  };

  const card = (title: string, metrics: Array<{ label: string; value: number; hint?: string | null }>) => (
    <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{title}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[rgb(var(--muted))]">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--muted))]">{m.label}</p>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">{m.value}</p>
            {m.hint ? <p className="text-[10px] text-[rgb(var(--muted))]">{m.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {error ? <ErrorBanner title="System status error" message={error.message} requestId={error.requestId ?? requestId} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:opacity-50"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <span className="text-[11px] text-[rgb(var(--muted))]">Updated: {new Date(status.now).toLocaleString()}</span>
        {status.deployment.vercelId ? <span className="text-[10px] text-[rgb(var(--muted))]">Vercel: {status.deployment.vercelId}</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {card("Billing", [
          { label: "Recheck 429 (24h)", value: status.health.billingRecheck429_24h },
          { label: "Portal errors (24h)", value: status.health.portalErrors_24h },
        ])}
        {card("Webhooks", [
          { label: "Failures (24h)", value: status.health.webhookFailures_24h },
          { label: "Repeats (24h)", value: status.health.webhookRepeats_24h, hint: status.queues.webhookFailuresQueue.repeatsTop ? `Top: ${status.queues.webhookFailuresQueue.repeatsTop}` : null },
        ])}
        {card("Ops activity", [
          { label: "Incidents (24h)", value: status.health.incidents_24h },
          { label: "Audits (24h)", value: status.health.audits_24h },
        ])}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/app/ops/incidents?range=24h"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "incidents" })}
        >
          Open incidents
        </Link>
        <Link
          href="/app/ops/webhooks?since=24h"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "webhooks" })}
        >
          Open webhooks
        </Link>
      </div>
      {status.notes.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Notes</p>
          <ul className="mt-1 list-disc pl-5">
            {status.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
