"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { coerceOpsAlertsModel, type OpsAlertsModel } from "@/lib/ops/alerts-model";
import { formatShortLocalTime } from "@/lib/time/format-short";

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

type AlertEvent = { id: string; key: string; state: string; at: string; summary: string; signals: Record<string, any>; isTest?: boolean; severity?: string | null };

type HandledMap = Record<string, { at: string }>;

const HANDLED_COOLDOWN_MS = 15 * 60 * 1000;

export default function AlertsClient({ initial, initialError, requestId }: { initial: OpsAlertsModel | null; initialError?: { message?: string; requestId?: string | null; code?: string | null } | null; requestId: string | null }) {
  const [data, setData] = useState<OpsAlertsModel>(coerceOpsAlertsModel(initial));
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(
    initialError ? { message: initialError.message ?? "Unable to load alerts", requestId: initialError.requestId ?? requestId ?? null } : null
  );
  const [loadState, setLoadState] = useState<"ok" | "error">(initialError ? "error" : "ok");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<"firing" | "recent">("firing");
  const [lastCheckedAtIso, setLastCheckedAtIso] = useState<string | null>(new Date().toISOString());
  const [handled, setHandled] = useState<HandledMap>(initial?.handled ?? {});
  const [handledNotes, setHandledNotes] = useState<Record<string, string>>({});
  const [handledSaving, setHandledSaving] = useState<Record<string, boolean>>({});
  const [handledErrors, setHandledErrors] = useState<Record<string, string | null>>({});
  const [testEventsOpen, setTestEventsOpen] = useState(false);
  const handledViewLogged = useRef<Set<string>>(new Set());

  const firingAlerts = useMemo(() => (data?.alerts ?? []).filter((a) => a?.state === "firing"), [data?.alerts]);
  const recentEvents = useMemo(() => data?.recentEvents ?? [], [data?.recentEvents]);
  const testEvents = useMemo(() => recentEvents.filter((ev) => ev?.isTest), [recentEvents]);
  const normalEvents = useMemo(() => recentEvents.filter((ev) => !ev?.isTest), [recentEvents]);

  useEffect(() => {
    if (!initialError) return;
    logMonetisationClientEvent("ops_alerts_load_error", null, "ops", {
      meta: { code: initialError.code ?? "UNKNOWN", status: 0, hasJson: Boolean(initial), mode: "initial" },
    });
    setLoadState("error");
  }, [initialError, initial]);

  useEffect(() => {
    if (!data) return;
    logMonetisationClientEvent("ops_alerts_view", null, "ops", { firing: data.firingCount, rulesVersion: data.rulesVersion });
  }, [data, data?.firingCount, data?.rulesVersion]);

  useEffect(() => {
    if (loadState === "ok") {
      logMonetisationClientEvent("ops_alerts_load_ok", null, "ops");
    }
  }, [loadState]);

  useEffect(() => {
    if (!data?.handled) return;
    setHandled((prev) => {
      const merged: HandledMap = { ...prev };
      Object.entries(data.handled ?? {}).forEach(([key, value]) => {
        if (!value?.at) return;
        if (!merged[key] || new Date(value.at).getTime() > new Date(merged[key].at).getTime()) {
          merged[key] = { at: value.at };
        }
      });
      return merged;
    });
  }, [data?.handled]);

  useEffect(() => {
    (data?.alerts ?? []).forEach((alert) => {
      if (handledViewLogged.current.has(alert.key)) return;
      handledViewLogged.current.add(alert.key);
      logMonetisationClientEvent("ops_alert_handled_view", null, "ops", { alertKey: alert.key });
    });
  }, [data?.alerts]);

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
        setLoadState("error");
        return;
      }
      setData(coerceOpsAlertsModel(res.json));
      setError(null);
      setLoadState("ok");
      logMonetisationClientEvent("ops_alerts_load_ok", null, "ops");
    } catch {
      setError({ message: "Unable to load alerts", requestId: null });
      logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "alerts", code: "NETWORK" });
      logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false, mode: "refresh" } });
      setLoadState("error");
    } finally {
      setLoading(false);
      setLastCheckedAtIso(new Date().toISOString());
    }
  };

  const sendTest = async () => {
    setFlash(null);
    setError(null);
    logMonetisationClientEvent("ops_alerts_test_click", null, "ops");
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
        logMonetisationClientEvent("ops_alerts_test_error", null, "ops", {
          meta: { code: res.error?.code ?? "UNKNOWN", status: res.status, hasJson: Boolean(res.json) },
        });
        setLoadState("error");
        return;
      }
      setFlash("Test alert sent");
      logMonetisationClientEvent("ops_alerts_test_success", null, "ops", { meta: { eventId: (res.json as any).eventId ?? null } });
      refresh();
    } catch {
      setError({ message: "Test alert failed", requestId: null });
      logMonetisationClientEvent("ops_alerts_test_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false } });
      setLoadState("error");
    }
  };

  const markHandled = async (alert: Alert) => {
    const key = alert.key;
    const note = handledNotes[key]?.trim() ?? "";
    const requestId = typeof alert?.signals?.requestId === "string" ? alert.signals.requestId : null;
    const signal = typeof alert.signals?.signal === "string" ? alert.signals.signal : null;
    const surface = typeof alert.signals?.surface === "string" ? alert.signals.surface : null;
    const code = typeof alert.signals?.code === "string" ? alert.signals.code : null;
    setHandledErrors((prev) => ({ ...prev, [key]: null }));
    setHandledSaving((prev) => ({ ...prev, [key]: true }));
    logMonetisationClientEvent("ops_alert_handled_click", null, "ops", { alertKey: key });
    try {
      const payload: Record<string, any> = {
        code: "alert_handled",
        note: note ? note.slice(0, 200) : undefined,
        requestId,
        meta: {
          alertKey: key,
          window_label: typeof data?.window?.minutes === "number" ? `${data.window.minutes}m` : data?.window ?? "15m",
          signal,
          surface,
          code,
        },
      };
      const res = await fetch("/api/ops/resolution-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok || !body?.ok) {
        const msg = body?.error?.message ?? "Unable to mark handled";
        setHandledErrors((prev) => ({ ...prev, [key]: msg }));
        logMonetisationClientEvent("ops_alert_handled_error", null, "ops", {
          alertKey: key,
          code: body?.error?.code ?? res.status ?? "UNKNOWN",
        });
        return;
      }
      const handledAt = body?.item?.createdAt ?? new Date().toISOString();
      setHandled((prev) => ({ ...prev, [key]: { at: handledAt } }));
      setHandledNotes((prev) => ({ ...prev, [key]: "" }));
      logMonetisationClientEvent("ops_alert_handled_save", null, "ops", { alertKey: key });
    } catch {
      setHandledErrors((prev) => ({ ...prev, [key]: "Unable to mark handled" }));
      logMonetisationClientEvent("ops_alert_handled_error", null, "ops", { alertKey: key, code: "NETWORK" });
    } finally {
      setHandledSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderAlertCard = (alert: Alert) => {
    const handledInfo = handled[alert.key];
    const handledRecent = handledInfo ? Date.now() - new Date(handledInfo.at).getTime() < HANDLED_COOLDOWN_MS : false;
    const note = handledNotes[alert.key] ?? "";
    const handledError = handledErrors[alert.key] ?? null;
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
            {handledInfo ? <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Handled {formatShortLocalTime(handledInfo.at)}</span> : null}
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
        <div className="mt-3 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Mark handled</p>
            {handledRecent ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Cooldown (15m)</span> : null}
          </div>
          {!handledRecent ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type="text"
                value={note}
                placeholder="Optional note"
                onChange={(e) => setHandledNotes((prev) => ({ ...prev, [alert.key]: e.target.value }))}
                className="w-full rounded-md border border-emerald-200 px-3 py-1 text-sm text-[rgb(var(--ink))]"
              />
              <button
                type="button"
                onClick={() => markHandled(alert)}
                disabled={handledSaving[alert.key]}
                className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
              >
                {handledSaving[alert.key] ? "Saving…" : "Mark handled"}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-[rgb(var(--muted))]">Handled recently — we will keep this alert quiet for a bit.</p>
          )}
          {handledError ? <p className="text-[11px] text-rose-700">{handledError}</p> : null}
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
          {!data?.webhookConfigured ? (
            <p className="text-[11px] text-[rgb(var(--muted))]">
              Notifications: Not configured (webhook).{" "}
              <Link
                href="/app/ops/status#alerts"
                onClick={() => logMonetisationClientEvent("ops_alerts_webhook_setup_click", null, "ops", { meta: { destination: "ops_status" } })}
                className="underline"
              >
                Setup
              </Link>
            </p>
          ) : null}
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
            <span className="text-sm font-semibold text-[rgb(var(--ink))]">
              {loadState === "ok" ? data?.headline ?? "No alerts firing (last 15m)" : "Alerts unavailable"}
            </span>
          </div>
          <div className="text-right text-[11px] text-[rgb(var(--muted))]">
            <div>Window: last 15 minutes</div>
            <div>Last checked: {formatShortLocalTime(lastCheckedAtIso)}</div>
          </div>
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

      {loadState === "error" && error ? <ErrorBanner title="Alerts unavailable" message={error.message} requestId={error.requestId ?? requestId ?? undefined} /> : null}

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
        <div className="space-y-3">
          <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
            {normalEvents.length ? (
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
                  {normalEvents.map((ev) => (
                    <tr key={ev.id} className="border-t">
                      <td className="px-2 py-1">{formatShortLocalTime(ev.at)}</td>
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
          {testEvents.length ? (
            <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">Test events</p>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                  onClick={() => setTestEventsOpen((open) => !open)}
                >
                  {testEventsOpen ? "Hide" : "Show"}
                </button>
              </div>
              {testEventsOpen ? (
                <ul className="mt-2 space-y-2">
                  {testEvents.map((ev) => {
                    const auditsHref = ev.signals?.requestId
                      ? `/app/ops/audits?requestId=${encodeURIComponent(ev.signals.requestId)}`
                      : `/app/ops/audits?q=${encodeURIComponent(ev.id ?? ev.key ?? "ops_alert_test")}`;
                    return (
                      <li key={ev.id} className="rounded-lg border border-black/5 bg-white px-3 py-2 text-xs text-[rgb(var(--muted))]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[rgb(var(--ink))]">
                            {formatShortLocalTime(ev.at)} · {ev.summary}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--muted))]">
                            {ev.severity ?? "low"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Link href={auditsHref} className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline">
                            Open in Audits
                          </Link>
                          <Link
                            href="/app/ops/incidents?window=15m&surface=ops&signal=alert_test&from=ops_alerts"
                            className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                          >
                            Open in Incidents
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
