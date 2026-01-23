"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { coerceOpsAlertsModel, type OpsAlertsModel } from "@/lib/ops/alerts-model";

type Alert = {
  key: string;
  severity: "low" | "medium" | "high";
  state: "ok" | "firing";
  summary: string;
  startedAt?: string | null;
  lastSeenAt?: string | null;
  signals: Record<string, any>;
  actions: Array<{ label: string; href: string; kind?: string }>;
};

type AlertEvent = { id: string; key: string; state: string; at: string; summary: string; signals: Record<string, any> };

export default function AlertsClient({ initial, initialError, requestId }: { initial: OpsAlertsModel | null; initialError?: { message?: string; requestId?: string | null; code?: string | null } | null; requestId: string | null }) {
  const [data, setData] = useState<OpsAlertsModel>(coerceOpsAlertsModel(initial));
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(
    initialError ? { message: initialError.message ?? "Unable to load alerts", requestId: initialError.requestId ?? requestId ?? null } : null
  );
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<"firing" | "recent">("firing");

  const firingAlerts = useMemo(() => (data?.alerts ?? []).filter((a) => a?.state === "firing"), [data?.alerts]);

  useEffect(() => {
    if (!initialError) return;
    logMonetisationClientEvent("ops_alerts_load_error", null, "ops", {
      meta: { code: initialError.code ?? "UNKNOWN", status: 0, hasJson: Boolean(initial), mode: "initial" },
    });
  }, [initialError, initial]);

  useEffect(() => {
    if (!data) return;
    logMonetisationClientEvent("ops_alerts_view", null, "ops", { firing: data.firingCount, rulesVersion: data.rulesVersion });
  }, [data, data?.firingCount, data?.rulesVersion]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const headlineTone = useMemo(() => {
    if (!data) return { label: "Unavailable", className: "bg-slate-100 text-slate-700" };
    if ((data.alerts ?? []).length === 0) return { label: "Green", className: "bg-emerald-100 text-emerald-800" };
    const hasHigh = (data.alerts ?? []).some((a) => a?.state === "firing" && a?.severity === "high");
    return hasHigh
      ? { label: "Red", className: "bg-rose-100 text-rose-800" }
      : { label: "Amber", className: "bg-amber-100 text-amber-800" };
  }, [data]);

  const refresh = async () => {
    setLoading(true);
    setFlash(null);
    logMonetisationClientEvent("ops_alerts_refresh_click", null, "ops");
    try {
      const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts", { method: "GET", cache: "no-store" });
      if (res.status === 429 || res.error?.code === "RATE_LIMITED") {
        const retrySeconds = 30;
        setCooldown(retrySeconds);
        setError({ message: "Rate limited — try again shortly", requestId: res.requestId ?? null });
        logMonetisationClientEvent("ops_panel_rate_limited", null, "ops", { panel: "alerts", retryAfterSeconds: retrySeconds });
        return;
      }
      if (!res.ok || !res.json) {
        setError({ message: res.error?.message ?? "Unable to load alerts", requestId: res.requestId ?? null });
        logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "alerts", code: res.error?.code ?? "UNKNOWN" });
        logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: res.error?.code ?? "UNKNOWN", status: res.status, hasJson: Boolean(res.json), mode: "refresh" } });
        return;
      }
      setData(coerceOpsAlertsModel(res.json));
      setError(null);
    } catch {
      setError({ message: "Unable to load alerts", requestId: null });
      logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "alerts", code: "NETWORK" });
      logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false, mode: "refresh" } });
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setFlash(null);
    setError(null);
    logMonetisationClientEvent("ops_alert_test_fire", null, "ops");
    try {
      const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts/test", { method: "POST", cache: "no-store" });
      if (res.status === 429 || res.error?.code === "RATE_LIMITED") {
        const retrySeconds = 30;
        setCooldown(retrySeconds);
        setError({ message: "Rate limited — try again shortly", requestId: res.requestId ?? null });
        return;
      }
      if (!res.ok || !res.json) {
        setError({ message: res.error?.message ?? "Test alert failed", requestId: res.requestId ?? null });
        logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: res.error?.code ?? "UNKNOWN", status: res.status, hasJson: Boolean(res.json), mode: "test" } });
        return;
      }
      setFlash("Test alert sent");
      refresh();
    } catch {
      setError({ message: "Test alert failed", requestId: null });
      logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false, mode: "test" } });
    }
  };

  const renderAlertCard = (alert: Alert) => {
    return (
      <div key={alert.key} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${alert.severity === "high" ? "bg-rose-100 text-rose-800" : alert.severity === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
              {alert.severity.toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-[rgb(var(--ink))]">{alert.summary}</span>
          </div>
          <div className="text-[11px] text-[rgb(var(--muted))]">
            {alert.startedAt ? `Started: ${alert.startedAt}` : null} {alert.lastSeenAt ? `· Last seen: ${alert.lastSeenAt}` : null}
          </div>
        </div>
        <div className="mt-2 text-xs text-[rgb(var(--muted))]">
          {Object.entries(alert.signals ?? {})
            .slice(0, 3)
            .map(([k, v]) => (
              <span key={k} className="mr-2 rounded-full bg-slate-100 px-2 py-1 font-semibold text-[rgb(var(--ink))]">
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {alert.actions?.map((action) => (
            <Link
              key={`${alert.key}-${action.href}`}
              href={action.href}
              onClick={() => logMonetisationClientEvent("ops_alert_action_click", null, "ops", { key: alert.key, actionKind: action.kind ?? null })}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
          <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Alerts</h1>
          <p className="text-xs text-[rgb(var(--muted))]">Thresholded 15m signals with actionable links.</p>
          {!data?.webhookConfigured ? <p className="text-[11px] text-amber-700">Webhook not configured (OPS_ALERT_WEBHOOK_URL).</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading || cooldown > 0}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] disabled:opacity-50"
          >
            {cooldown > 0 ? `Retry in ${cooldown}s` : loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={sendTest}
            className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white"
            disabled={loading}
          >
            Send test alert
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${headlineTone.className}`}>System health · {headlineTone.label}</span>
            <span className="text-sm font-semibold text-[rgb(var(--ink))]">{data?.headline ?? "Alerts unavailable"}</span>
          </div>
            <span className="text-[11px] text-[rgb(var(--muted))]">Window: last 15 minutes</span>
        </div>
        {flash ? <p className="mt-2 text-[11px] text-emerald-700">{flash}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("firing")}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tab === "firing" ? "bg-[rgb(var(--ink))] text-white" : "bg-white text-[rgb(var(--ink))] border border-black/10"}`}
        >
          Firing
        </button>
        <button
          type="button"
          onClick={() => setTab("recent")}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tab === "recent" ? "bg-[rgb(var(--ink))] text-white" : "bg-white text-[rgb(var(--ink))] border border-black/10"}`}
        >
          Recent (24h)
        </button>
      </div>

      {error ? <ErrorBanner title="Alerts unavailable" message={error.message} requestId={error.requestId ?? requestId ?? undefined} /> : null}

      {tab === "firing" ? (
        firingAlerts.length ? (
          <div className="space-y-2">
            {firingAlerts.map((alert) => renderAlertCard(alert))}
          </div>
        ) : (
          <p className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-[rgb(var(--muted))] shadow-sm">
            No alerts firing (last 15m).{" "}
            <button type="button" onClick={refresh} className="underline" disabled={loading || cooldown > 0}>
              Refresh
            </button>
          </p>
        )
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
          {data?.recentEvents?.length ? (
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                <tr>
                  <th className="px-2 py-1">At</th>
                  <th className="px-2 py-1">Key</th>
                  <th className="px-2 py-1">State</th>
                  <th className="px-2 py-1">Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.map((ev) => (
                  <tr key={ev.id} className="border-t">
                    <td className="px-2 py-1">{ev.at}</td>
                    <td className="px-2 py-1 font-mono text-[11px] text-[rgb(var(--muted))]">{ev.key}</td>
                    <td className="px-2 py-1">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          ev.state === "firing" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {ev.state}
                      </span>
                    </td>
                    <td className="px-2 py-1">{ev.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-[rgb(var(--muted))]">No recent alert events.</p>
          )}
        </div>
      )}
    </div>
  );
}
