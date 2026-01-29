"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { buildOpsIncidentsLink } from "@/lib/ops/ops-links";
import type { SystemStatus } from "@/lib/ops/system-status";
import type { RagStatus } from "@/lib/ops/rag-status";

type Props = {
  initialStatus: SystemStatus;
  requestId: string | null;
};

type SignalKey = RagStatus["signals"][number]["key"];

export default function SystemStatusClient({ initialStatus, requestId }: Props) {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const [rag, setRag] = useState<RagStatus | null>(initialStatus.rag ?? null);
  const [ragLogged, setRagLogged] = useState(false);
  const [drillLogged, setDrillLogged] = useState(false);
  const [trendLogged, setTrendLogged] = useState(false);
  const [directionLogged, setDirectionLogged] = useState(false);
  const [ragError, setRagError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [ragCooldown, setRagCooldown] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [topRepeatsLogged, setTopRepeatsLogged] = useState(false);
  const [watchStatus, setWatchStatus] = useState<Record<string, string>>({});
  const [webhookConfigLogged, setWebhookConfigLogged] = useState(false);
  const [triageNotice, setTriageNotice] = useState<string | null>(null);
  const [triageError, setTriageError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [triageSending, setTriageSending] = useState(false);
  const triageViewLogged = useRef(false);
  const webhookConfig = status.webhookConfig ?? null;
  const webhookConfigured = Boolean(webhookConfig?.configured);
  const triageWindow = "24h";
  const triageWindowLabel = rag?.window?.minutes ? `${rag.window.minutes}m` : "15m";
  const buildAuditsLink = (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("range", triageWindow);
    params.set("from", "ops_status");
    return `/app/ops/audits?${params.toString()}`;
  };
  const buildDeliveriesLink = (statusParam: string) => {
    const params = new URLSearchParams();
    params.set("tab", "deliveries");
    params.set("status", statusParam);
    params.set("window", triageWindow);
    params.set("from", "ops_status");
    return `/app/ops/alerts?${params.toString()}`;
  };
  const logTriageAction = (reasonKey: SignalKey, action: string, destination: string) => {
    logMonetisationClientEvent("ops_status_triage_action_click", null, "ops", {
      reasonKey,
      action,
      window: triageWindowLabel,
      destination,
      hasWebhookConfig: webhookConfigured,
    });
  };
  const sendWebhookTest = async (reasonKey: SignalKey) => {
    if (triageSending || !webhookConfigured) return;
    logTriageAction(reasonKey, "send_webhook_test", "/api/ops/alerts/webhook-test");
    setTriageNotice(null);
    setTriageError(null);
    setTriageSending(true);
    try {
      const res = await fetchJsonSafe<{ eventId?: string }>("/api/ops/alerts/webhook-test", { method: "POST", cache: "no-store" });
      if (res.status === 429 || res.error?.code === "RATE_LIMITED") {
        setTriageError({ message: "Rate limited — try again shortly", requestId: res.requestId ?? null });
        return;
      }
      if (!res.ok || !res.json) {
        setTriageError({ message: res.error?.message ?? "Webhook test failed", requestId: res.requestId ?? null });
        return;
      }
      setTriageNotice("Webhook test queued.");
    } catch {
      setTriageError({ message: "Webhook test failed", requestId: null });
    } finally {
      setTriageSending(false);
    }
  };

  useEffect(() => {
    logMonetisationClientEvent("ops_system_status_view", null, "ops");
    fetchRag();
  }, []);

  useEffect(() => {
    if (!status.webhookConfig || webhookConfigLogged) return;
    setWebhookConfigLogged(true);
    logMonetisationClientEvent("ops_alerts_webhook_config_view", null, "ops", {
      meta: {
        mode: status.webhookConfig.mode,
        hasUrl: status.webhookConfig.safeMeta?.hasUrl ?? status.webhookConfig.hasUrl ?? false,
        hasSecret: status.webhookConfig.safeMeta?.hasSecret ?? status.webhookConfig.hasSecret ?? false,
      },
    });
  }, [status.webhookConfig, webhookConfigLogged]);

  useEffect(() => {
    if (!rag || triageViewLogged.current) return;
    triageViewLogged.current = true;
    logMonetisationClientEvent("ops_status_triage_view", null, "ops", { window: triageWindowLabel });
  }, [rag, triageWindowLabel]);

  useEffect(() => {
    setRagLogged(false);
    setDrillLogged(false);
    setTrendLogged(false);
    setDirectionLogged(false);
  }, [rag?.updatedAt, rag?.status]);

  useEffect(() => {
    if (rag && !ragLogged) {
      setRagLogged(true);
      logMonetisationClientEvent("ops_status_rag_view", null, "ops", {
        overall: rag.status ?? rag.overall,
        topIssueKey: rag.topIssues?.[0]?.key ?? null,
        rulesVersion: rag.rulesVersion,
      });
    }
  }, [rag, ragLogged]);

  useEffect(() => {
    if (rag && !drillLogged) {
      setDrillLogged(true);
      logMonetisationClientEvent("ops_status_rag_drilldown_view", null, "ops", {
        overall: rag.status ?? rag.overall,
        rulesVersion: rag.rulesVersion,
      });
    }
  }, [drillLogged, rag]);

  useEffect(() => {
    if (rag?.trend && !trendLogged) {
      setTrendLogged(true);
      logMonetisationClientEvent("ops_status_rag_trend_view", null, "ops", { rulesVersion: rag.rulesVersion });
    }
  }, [rag?.trend, rag?.rulesVersion, trendLogged]);

  useEffect(() => {
    if (rag?.trend && !directionLogged) {
      setDirectionLogged(true);
      const buckets = rag.trend.buckets ?? [];
      const last = buckets[buckets.length - 1];
      const prev = buckets[buckets.length - 2];
      logMonetisationClientEvent("ops_status_rag_trend_direction", null, "ops", {
        direction: rag.trend.direction,
        scoreNow: last?.score ?? null,
        scorePrev: prev?.score ?? null,
      });
    }
  }, [directionLogged, rag?.trend, rag?.trend?.direction]);

  useEffect(() => {
    if (rag?.topRepeats && !topRepeatsLogged) {
      setTopRepeatsLogged(true);
      logMonetisationClientEvent("ops_status_top_repeats_view", null, "ops", { windowMinutes: rag.window.minutes });
    }
  }, [rag?.topRepeats, rag?.window?.minutes, topRepeatsLogged]);

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
        logMonetisationClientEvent("ops_panel_rate_limited", null, "ops", { panel: "system_status", retryAfterSeconds: retrySeconds });
        return;
      }
      if (!body?.ok) {
        setRagError({ message: body?.error?.message ?? "Unable to load system health", requestId: body?.error?.requestId ?? null });
        logMonetisationClientEvent("ops_status_rag_fetch_error", null, "ops", { code: body?.error?.code ?? "UNKNOWN", requestId: body?.error?.requestId ?? null });
        logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "system_status", code: body?.error?.code ?? "UNKNOWN" });
        return;
      }
      setStatus(body.status);
      setRag(body.status?.rag ?? null);
      if (body.status?.rag) {
        logMonetisationClientEvent("ops_status_rag_view", null, "ops", {
          overall: body.status.rag.status ?? body.status.rag.overall,
          topIssueKey: body.status.rag.topIssues?.[0]?.key ?? null,
          rulesVersion: body.status.rag.rulesVersion,
        });
      }
    } catch {
      setRagError({ message: "Unable to load system health", requestId: null });
      logMonetisationClientEvent("ops_status_rag_fetch_error", null, "ops", { code: "NETWORK", requestId: null });
      logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "system_status", code: "NETWORK" });
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
        logMonetisationClientEvent("ops_panel_rate_limited", null, "ops", { panel: "system_status", retryAfterSeconds });
        setLoading(false);
        return;
      }
      if (!body?.ok) {
        setError({ message: body?.error?.message ?? "Unable to refresh", requestId: body?.error?.requestId ?? null });
        logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "system_status", code: body?.error?.code ?? "UNKNOWN" });
        setLoading(false);
        return;
      }
      setStatus(body.status);
      setLoading(false);
      void fetchRag();
    } catch {
      setError({ message: "Unable to refresh", requestId: null });
      logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "system_status", code: "NETWORK" });
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

  const handleWatchRepeat = async (requestId: string, count: number) => {
    setWatchStatus((prev) => ({ ...prev, [requestId]: "Saving..." }));
    logMonetisationClientEvent("ops_status_top_repeats_watch_click", null, "ops", { requestId, count });
    try {
      const res = await fetch("/api/ops/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, reasonCode: "repeat_request", note: `repeat ${count} in 15m`, ttlHours: 24 }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 429 || body?.error?.code === "RATE_LIMITED") {
        const retryAfter = Number(res.headers.get("retry-after") ?? body?.retryAfter ?? 0);
        const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
        setWatchStatus((prev) => ({ ...prev, [requestId]: retryAfterSeconds ? `Rate limited ~${retryAfterSeconds}s` : "Rate limited" }));
        logMonetisationClientEvent("ops_panel_rate_limited", null, "ops", { panel: "top_repeats", retryAfterSeconds });
        return;
      }
      if (body?.ok) {
        setWatchStatus((prev) => ({ ...prev, [requestId]: "Watch created" }));
      } else {
        setWatchStatus((prev) => ({ ...prev, [requestId]: "Watch failed" }));
        logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "top_repeats", code: body?.error?.code ?? "UNKNOWN" });
      }
    } catch {
      setWatchStatus((prev) => ({ ...prev, [requestId]: "Watch failed" }));
      logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "top_repeats", code: "NETWORK" });
    }
  };

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
      {status.webhookConfig ? (
        <div id="alerts" className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Alerts webhook</p>
              <p className="text-[11px] text-[rgb(var(--muted))]">{status.webhookConfig.hint}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--muted))]">{status.webhookConfig.mode.replace("_", " ")}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--ink))]">
              URL: {status.webhookConfig.safeMeta?.hasUrl ? "set" : "missing"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--ink))]">
              Secret: {status.webhookConfig.safeMeta?.hasSecret ? "set" : "missing"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={status.webhookConfig.setupHref}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "alerts_webhook_setup" })}
            >
              Configure
            </Link>
            <Link
              href="/app/ops/alerts"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_system_status_link_click", null, "ops", { target: "ops_alerts" })}
            >
              Open alerts
            </Link>
          </div>
        </div>
      ) : null}
      <div id="rag" className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">System health: {rag ? (rag.status ?? rag.overall).toUpperCase() : "—"} (last 15 minutes)</p>
            {rag ? (
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  (rag.status ?? rag.overall) === "green"
                    ? "bg-emerald-100 text-emerald-800"
                    : (rag.status ?? rag.overall) === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {(rag.status ?? rag.overall).toUpperCase()}
              </span>
            ) : null}
          </div>
          <span className="text-[11px] text-[rgb(var(--muted))]">
            {rag ? `Updated ${new Date(rag.updatedAt).toLocaleTimeString()}` : ragCooldown > 0 ? `Rate limited — try again in ${ragCooldown}s` : "Loading…"}
          </span>
        </div>
        {ragCooldown > 0 ? <p className="text-[11px] text-amber-800">Rate limited — try again in ~{ragCooldown}s.</p> : null}
        {ragError && !ragCooldown ? <p className="text-[11px] text-amber-800">Temporarily unavailable.</p> : null}
        {rag ? <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">{rag.headline}</p> : null}
        {ragError ? <ErrorBanner title="System health error" message={ragError.message} requestId={ragError.requestId ?? requestId} /> : null}
        {rag ? (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {rag.topIssues.map((issue) => (
                <div key={issue.key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      issue.severity === "red" ? "bg-rose-100 text-rose-800" : issue.severity === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {issue.severity.toUpperCase()}
                  </span>
                  <span className="font-semibold text-[rgb(var(--ink))]">{issue.label}</span>
                  <span className="text-[rgb(var(--muted))]">({issue.count})</span>
                  <Link
                    href={issue.primaryAction}
                    className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                    onClick={() => logMonetisationClientEvent("ops_status_rag_action_click", null, "ops", { actionKey: issue.key, overall: rag.status ?? rag.overall })}
                  >
                    Open
                  </Link>
                  {issue.secondaryAction ? (
                    <Link
                      href={issue.secondaryAction}
                      className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      onClick={() =>
                        logMonetisationClientEvent("ops_status_rag_action_click", null, "ops", { actionKey: `${issue.key}_secondary`, overall: rag.status ?? rag.overall })
                      }
                    >
                      Secondary
                    </Link>
                  ) : null}
                </div>
              ))}
              {rag.topIssues.length === 0 ? <span className="text-[11px] text-[rgb(var(--muted))]">All clear.</span> : null}
            </div>
            {rag.topRepeats ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Top repeats (15m)</p>
                  <span className="text-[10px] text-[rgb(var(--muted))]">Quick triage</span>
                </div>
                {rag.topRepeats.requestIds.length === 0 && rag.topRepeats.codes.length === 0 && rag.topRepeats.surfaces.length === 0 ? (
                  <p className="text-[11px] text-[rgb(var(--muted))]">No repeats observed.</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    {rag.topRepeats.requestIds.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {rag.topRepeats.requestIds.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1 text-[11px]">
                            <span className="font-semibold text-[rgb(var(--ink))]">{item.id}</span>
                            <span className="text-[rgb(var(--muted))]">({item.count})</span>
                            <button
                              type="button"
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                              onClick={() => {
                                navigator.clipboard.writeText(item.id).catch(() => undefined);
                                logMonetisationClientEvent("ops_status_top_repeats_click", null, "ops", { type: "requestId", requestId: item.id });
                              }}
                            >
                              Copy
                            </button>
                            <Link
                              href={buildOpsIncidentsLink({ window: "15m", requestId: item.id, signal: "repeat_request" })}
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                              onClick={() => logMonetisationClientEvent("ops_status_top_repeats_click", null, "ops", { type: "requestId_open", requestId: item.id })}
                            >
                              Open incidents
                            </Link>
                            <button
                              type="button"
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                              onClick={() => handleWatchRepeat(item.id, item.count)}
                            >
                              {watchStatus[item.id] ?? "Watch"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {rag.topRepeats.codes.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {rag.topRepeats.codes.map((entry) => (
                          <Link
                            key={`${entry.code}_${entry.count}`}
                            href={buildOpsIncidentsLink({ window: "15m", code: entry.code, signal: "repeat_code" })}
                            className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[rgb(var(--muted))] shadow-sm"
                            onClick={() => logMonetisationClientEvent("ops_status_top_repeats_click", null, "ops", { type: "code", code: entry.code })}
                          >
                            {entry.code} ({entry.count})
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {rag.topRepeats.surfaces.length ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {rag.topRepeats.surfaces.map((entry) => (
                          <Link
                            key={`${entry.surface}_${entry.count}`}
                            href={buildOpsIncidentsLink({ window: "15m", surface: entry.surface, signal: "repeat_surface" })}
                            className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[rgb(var(--muted))] shadow-sm"
                            onClick={() => logMonetisationClientEvent("ops_status_top_repeats_click", null, "ops", { type: "surface", surface: entry.surface })}
                          >
                            {entry.surface} ({entry.count})
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Why this status</p>
                <span className="text-[10px] text-[rgb(var(--muted))]">Window: {rag.window.minutes}m</span>
              </div>
              {triageNotice ? <p className="mt-1 text-[11px] text-emerald-700">{triageNotice}</p> : null}
              {triageError ? (
                <div className="mt-1">
                  <ErrorBanner title="Triage action failed" message={triageError.message} requestId={triageError.requestId ?? requestId ?? undefined} />
                </div>
              ) : null}
              <div className="mt-1 space-y-1">
                {rag.signals.map((signal) => {
                  const actions =
                    signal.key === "webhook_failures" || signal.key === "webhook_errors"
                      ? [
                          {
                            key: "view_deliveries_failed",
                            label: "View deliveries (failed)",
                            href: buildDeliveriesLink("failed"),
                          },
                          {
                            key: "send_webhook_test",
                            label: triageSending ? "Sending webhook..." : "Send webhook test",
                            onClick: () => sendWebhookTest(signal.key),
                            disabled: triageSending || !webhookConfigured,
                          },
                          {
                            key: "open_webhook_config",
                            label: "Open webhook config",
                            href: "/app/ops/status#alerts",
                          },
                        ]
                      : signal.key === "portal_errors"
                        ? [
                            {
                              key: "open_incidents",
                              label: "Open incidents",
                              href: buildOpsIncidentsLink({ window: triageWindow, surface: "portal", signal: "portal_errors", from: "ops_status" }),
                            },
                            {
                              key: "open_audits",
                              label: "Open audits",
                              href: buildAuditsLink("portal_error"),
                            },
                          ]
                        : signal.key === "checkout_errors"
                          ? [
                              {
                                key: "open_incidents",
                                label: "Open incidents",
                                href: buildOpsIncidentsLink({ window: triageWindow, surface: "checkout", signal: "checkout_errors", from: "ops_status" }),
                              },
                              {
                                key: "open_audits",
                                label: "Open audits",
                                href: buildAuditsLink("checkout_error"),
                              },
                            ]
                          : signal.key === "rate_limits"
                            ? [
                                {
                                  key: "open_incidents",
                                  label: "Open incidents",
                                  href: buildOpsIncidentsLink({ window: triageWindow, surface: "billing", code: "RATE_LIMIT", signal: "rate_limits", from: "ops_status" }),
                                },
                                {
                                  key: "open_audits",
                                  label: "Open audits",
                                  href: buildAuditsLink("rate_limited"),
                                },
                              ]
                            : [];
                  const tone =
                    signal.severity === "red" ? "bg-rose-100 text-rose-800" : signal.severity === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
                  return (
                    <div key={signal.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{signal.severity.toUpperCase()}</span>
                        <span className="font-semibold text-[rgb(var(--ink))]">{signal.label}</span>
                        <span className="text-[rgb(var(--muted))]">({signal.count})</span>
                        {signal.topCodes?.length ? (
                          <span className="flex flex-wrap items-center gap-1">
                            {signal.topCodes.map((code) => (
                              <span key={`${signal.key}_${code.code}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-[rgb(var(--muted))]">
                                {code.code} ({code.count})
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {signal.topSurfaces?.length ? (
                          <span className="flex flex-wrap items-center gap-1">
                            {signal.topSurfaces.map((surface) => (
                              <span key={`${signal.key}_${surface.surface}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-[rgb(var(--muted))]">
                                {surface.surface} ({surface.count})
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {signal.firstSeenAt ? (
                          <span className="text-[10px] text-[rgb(var(--muted))]" title={signal.firstSeenAt ?? undefined}>
                            First seen {new Date(signal.firstSeenAt).toLocaleTimeString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {actions.map((action) =>
                          action.href ? (
                            <Link
                              key={action.key}
                              href={action.href}
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                              onClick={() => logTriageAction(signal.key, action.key, action.href ?? "")}
                            >
                              {action.label}
                            </Link>
                          ) : (
                            <button
                              key={action.key}
                              type="button"
                              onClick={action.onClick}
                              disabled={action.disabled}
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:opacity-50"
                            >
                              {action.label}
                            </button>
                          )
                        )}
                      </div>
                      {(signal.key === "webhook_failures" || signal.key === "webhook_errors") && !webhookConfigured ? (
                        <div className="w-full text-[10px] text-[rgb(var(--muted))]">
                          Configure webhook first.{" "}
                          <Link href="/app/ops/status#alerts" className="underline" onClick={() => logTriageAction(signal.key, "open_webhook_config_hint", "/app/ops/status#alerts")}>
                            Open config
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {rag.trend ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">24h trend (15m buckets)</p>
                  <span className="text-[10px] text-[rgb(var(--muted))]">Direction: {rag.trend.direction}</span>
                </div>
                <div className="mt-2 flex items-end gap-[2px] overflow-hidden">
                  {rag.trend.buckets.map((bucket) => {
                    const height = Math.max(6, Math.round(bucket.score / 4));
                    const tone = bucket.red ? "bg-rose-400" : bucket.amber ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div
                        key={bucket.at}
                        className={`w-[6px] rounded-sm ${tone}`}
                        style={{ height }}
                        title={`${bucket.at} • score ${bucket.score}`}
                      />
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-[rgb(var(--muted))]">Scores trend toward 100 = healthy.</p>
              </div>
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
