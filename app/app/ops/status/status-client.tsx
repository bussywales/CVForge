"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { SystemStatus } from "@/lib/ops/system-status";
import type { RagStatus } from "@/lib/ops/rag-status";

type Props = {
  initialStatus: SystemStatus;
  requestId: string | null;
};

export default function SystemStatusClient({ initialStatus, requestId }: Props) {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const [rag, setRag] = useState<RagStatus | null>(initialStatus.rag ?? null);
  const [ragLogged, setRagLogged] = useState(false);
  const [ragError, setRagError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [ragCooldown, setRagCooldown] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);

  useEffect(() => {
    logMonetisationClientEvent("ops_system_status_view", null, "ops");
    fetchRag();
  }, []);

  useEffect(() => {
    if (rag && !ragLogged) {
      setRagLogged(true);
      logMonetisationClientEvent("ops_status_rag_view", null, "ops", {
        overall: rag.overall,
        topIssueKey: rag.topIssues?.[0]?.key ?? null,
        rulesVersion: rag.rulesVersion,
      });
    }
  }, [rag, ragLogged]);

  useEffect(() => {
    if (!status?.limits) return;
    logMonetisationClientEvent("system_status_limits_view", null, "ops", {
      billing: status.limits.rateLimitHits24h.billing_recheck,
      ops: status.limits.rateLimitHits24h.ops_actions,
      monetisation: status.limits.rateLimitHits24h.monetisation_log,
    });
  }, [status?.limits]);

  useEffect(() => {
    if (ragCooldown <= 0) return;
    const id = window.setInterval(() => setRagCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ragCooldown]);

  const fetchRag = async () => {
    setRagError(null);
    try {
      const res = await fetch("/api/ops/system-status", { method: "GET", cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (res.status === 429 || body?.error?.code === "RATE_LIMITED") {
        const retryAfter = Number(res.headers.get("retry-after") ?? body?.retryAfter ?? 0);
        const retrySeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30;
        setRagCooldown(retrySeconds);
        logMonetisationClientEvent("ops_status_rag_fetch_error", null, "ops", { code: "RATE_LIMITED", requestId: body?.error?.requestId ?? null });
        return;
      }
      if (!body?.ok) {
        setRagError({ message: body?.error?.message ?? "Unable to load system health", requestId: body?.error?.requestId ?? null });
        logMonetisationClientEvent("ops_status_rag_fetch_error", null, "ops", { code: body?.error?.code ?? "UNKNOWN", requestId: body?.error?.requestId ?? null });
        return;
      }
      setStatus(body.status);
      setRag(body.status?.rag ?? null);
      if (body.status?.rag) {
        logMonetisationClientEvent("ops_status_rag_view", null, "ops", {
          overall: body.status.rag.overall,
          topIssueKey: body.status.rag.topIssues?.[0]?.key ?? null,
          rulesVersion: body.status.rag.rulesVersion,
        });
      }
    } catch {
      setRagError({ message: "Unable to load system health", requestId: null });
      logMonetisationClientEvent("ops_status_rag_fetch_error", null, "ops", { code: "NETWORK", requestId: null });
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    logMonetisationClientEvent("ops_system_status_refresh_click", null, "ops");
    try {
      const res = await fetch("/api/ops/system-status", { method: "GET", cache: "no-store" });
      const body = await res.json();
      if (res.status === 429 || body?.error?.code === "RATE_LIMITED") {
        const retryAfter = Number(res.headers.get("retry-after") ?? body?.retryAfter ?? 0);
        const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
        setError({ message: retryAfterSeconds ? `Rate limited — try again in ~${retryAfterSeconds}s` : "Rate limited — try again shortly", requestId: body?.error?.requestId ?? requestId });
        logMonetisationClientEvent("ops_action_rate_limited", null, "ops", { action: "system_status", retryAfterSeconds });
        setLoading(false);
        return;
      }
      if (!body?.ok) {
        setError({ message: body?.error?.message ?? "Unable to refresh", requestId: body?.error?.requestId ?? null });
      setLoading(false);
      return;
    }
    setStatus(body.status);
    setLoading(false);
    void fetchRag();
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
      <div id="rag" className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">System health: {rag ? rag.overall.toUpperCase() : "—"} (last 15 minutes)</p>
            {rag ? (
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  rag.overall === "green"
                    ? "bg-emerald-100 text-emerald-800"
                    : rag.overall === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {rag.overall.toUpperCase()}
              </span>
            ) : null}
          </div>
          <span className="text-[11px] text-[rgb(var(--muted))]">
            {rag ? `Updated ${new Date(rag.updatedAt).toLocaleTimeString()}` : ragCooldown > 0 ? `Rate limited — try again in ${ragCooldown}s` : "Loading…"}
          </span>
        </div>
        {ragError ? <ErrorBanner title="System health error" message={ragError.message} requestId={ragError.requestId ?? requestId} /> : null}
        {rag ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {rag.topIssues.map((issue) => (
                <div key={issue.key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      issue.state === "red" ? "bg-rose-100 text-rose-800" : issue.state === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {issue.state.toUpperCase()}
                  </span>
                  <span className="font-semibold text-[rgb(var(--ink))]">{issue.label}</span>
                  <span className="text-[rgb(var(--muted))]">({issue.count})</span>
                  <Link
                    href={issue.primaryAction}
                    className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                    onClick={() => logMonetisationClientEvent("ops_status_rag_action_click", null, "ops", { actionKey: issue.key, overall: rag.overall })}
                  >
                    Open
                  </Link>
                  {issue.secondaryAction ? (
                    <Link
                      href={issue.secondaryAction}
                      className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      onClick={() =>
                        logMonetisationClientEvent("ops_status_rag_action_click", null, "ops", { actionKey: `${issue.key}_secondary`, overall: rag.overall })
                      }
                    >
                      Secondary
                    </Link>
                  ) : null}
                </div>
              ))}
              {rag.topIssues.length === 0 ? <span className="text-[11px] text-[rgb(var(--muted))]">All clear.</span> : null}
            </div>
            {rag.topIssues[0] ? (
              <p className="text-[11px] text-[rgb(var(--muted))]">Most common issue: {rag.topIssues[0].label} ({rag.topIssues[0].count})</p>
            ) : null}
          </div>
        ) : null}
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
      <div id="limits" className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Limits (approx)</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/ops/audits?q=rate_limited"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "audits_rate_limit" })}
            >
              Open audits
            </Link>
            <Link
              href="/app/ops/incidents?surface=billing&code=RATE_LIMIT"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "incidents_rate_limit" })}
            >
              Open incidents
            </Link>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]">
            Billing recheck: {status.limits.rateLimitHits24h.billing_recheck}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]">
            Monetisation log: {status.limits.rateLimitHits24h.monetisation_log}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]">
            Ops actions: {status.limits.rateLimitHits24h.ops_actions}
          </span>
        </div>
        {status.limits.topLimitedRoutes24h.length > 0 ? (
          <div className="mt-2 text-[11px] text-[rgb(var(--muted))]">
            <p className="font-semibold text-[rgb(var(--ink))]">Top limited routes</p>
            <ul className="mt-1 space-y-1">
              {status.limits.topLimitedRoutes24h.slice(0, 4).map((entry) => (
                <li key={entry.route} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
                  <span className="text-[10px] font-semibold text-[rgb(var(--ink))]">{entry.route}</span>
                  <span className="text-[10px] text-[rgb(var(--muted))]">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
