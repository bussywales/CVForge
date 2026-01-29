"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { coerceOpsAlertsModel, type OpsAlertsModel } from "@/lib/ops/alerts-model";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { buildAckLink } from "@/lib/ops/alerts-ack-link";

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

type HandledMap = Record<string, { at: string; by?: string | null; source?: string | null }>;

const HANDLED_COOLDOWN_MS = 15 * 60 * 1000;
const OWNERSHIP_WINDOW = "15m";
const SNOOZE_OPTIONS = [
  { minutes: 60, label: "Snooze 1h" },
  { minutes: 24 * 60, label: "Snooze 24h" },
];

export default function AlertsClient({ initial, initialError, requestId }: { initial: OpsAlertsModel | null; initialError?: { message?: string; requestId?: string | null; code?: string | null } | null; requestId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<OpsAlertsModel>(coerceOpsAlertsModel(initial));
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(
    initialError ? { message: initialError.message ?? "Unable to load alerts", requestId: initialError.requestId ?? requestId ?? null } : null
  );
  const [loadState, setLoadState] = useState<"ok" | "error">(initialError ? "error" : "ok");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<"firing" | "recent">("firing");
  const [lastLoadedFiringAt, setLastLoadedFiringAt] = useState<string | null>(null);
  const [lastLoadedRecentAt, setLastLoadedRecentAt] = useState<string | null>(null);
  const [lastCheckedAtIso, setLastCheckedAtIso] = useState<string | null>(new Date().toISOString());
  const [handled, setHandled] = useState<HandledMap>(initial?.handled ?? {});
  const [handledNotes, setHandledNotes] = useState<Record<string, string>>({});
  const [handledSaving, setHandledSaving] = useState<Record<string, boolean>>({});
  const [handledErrors, setHandledErrors] = useState<Record<string, string | null>>({});
  const [testEventsOpen, setTestEventsOpen] = useState(false);
  const handledViewLogged = useRef<Set<string>>(new Set());
  const [handoffNotes, setHandoffNotes] = useState<Record<string, string>>({});
  const [ownership, setOwnership] = useState<Record<string, { claimedByUserId: string; claimedAt: string; expiresAt: string; eventId?: string | null; note?: string | null }>>(
    initial?.ownership ?? {}
  );
  const [snoozes, setSnoozes] = useState<Record<string, { snoozedByUserId: string; snoozedAt: string; untilAt: string; reason?: string | null }>>(initial?.snoozes ?? {});
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const testEventsRef = useRef<HTMLDivElement | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testCooldownSeconds, setTestCooldownSeconds] = useState(0);
  const [pollHint, setPollHint] = useState<string | null>(null);
  const cooldownLoggedRef = useRef(false);
  const cooldownKeyRef = useRef<string | null>(null);
  const pollRef = useRef<{ timer: number | null; attempts: number; eventId: string; running: boolean } | null>(null);
  const ackViewLogged = useRef(false);
  const deliveryViewLogged = useRef(false);
  const [ackState, setAckState] = useState<Record<string, { acknowledged: boolean; requestId?: string | null }>>({});
  const previousTabRef = useRef<"firing" | "recent">(tab);
  const tabInitializedRef = useRef(false);
  const initialLoadedRef = useRef(false);

  const resolveTab = (value: string | null) => (value === "recent" || value === "firing" ? (value as "recent" | "firing") : null);
  const tabParam = resolveTab(searchParams?.get("tab"));

  const markLastLoaded = useCallback((target: "firing" | "recent", at: string) => {
    if (target === "recent") {
      setLastLoadedRecentAt(at);
    } else {
      setLastLoadedFiringAt(at);
    }
  }, []);

  const firingAlerts = useMemo(() => (data?.alerts ?? []).filter((a) => a?.state === "firing"), [data?.alerts]);
  const recentEvents = useMemo(() => data?.recentEvents ?? [], [data?.recentEvents]);
  const testEvents = useMemo(() => recentEvents.filter((ev) => ev?.isTest), [recentEvents]);
  const normalEvents = useMemo(() => recentEvents.filter((ev) => !ev?.isTest), [recentEvents]);

  const windowLabel = useMemo(() => {
    if (typeof (data as any)?.window?.minutes === "number") return `${(data as any).window.minutes}m`;
    if (typeof (data as any)?.window === "string") return (data as any).window;
    return "15m";
  }, [data]);

  useEffect(() => {
    cooldownKeyRef.current = `ops_alerts_test_cooldown_until_${windowLabel}`;
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(cooldownKeyRef.current);
    if (stored) {
      const until = Number(stored);
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (remaining > 0) setTestCooldownSeconds(remaining);
    }
  }, [windowLabel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tabParam) {
      tabInitializedRef.current = true;
      if (tabParam !== tab) setTab(tabParam);
      return;
    }
    if (tabInitializedRef.current) return;
    const stored = resolveTab(window.sessionStorage.getItem("ops_alerts_tab"));
    if (stored && stored !== tab) setTab(stored);
    tabInitializedRef.current = true;
  }, [tabParam, tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("ops_alerts_tab", tab);
    if (tabParam !== tab) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [tab, tabParam, pathname, router, searchParams]);

  useEffect(() => {
    if (!tabInitializedRef.current) return;
    if (initialLoadedRef.current) return;
    if (!data || initialError) return;
    markLastLoaded(tab, new Date().toISOString());
    initialLoadedRef.current = true;
  }, [data, initialError, markLastLoaded, tab]);

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

  const loadWorkflow = async () => {
    setWorkflowLoading(true);
    setWorkflowError(null);
    try {
      const res = await fetchJsonSafe<{ ownership?: any; snoozes?: any; serverNow?: string }>("/api/ops/alerts/workflow", {
        cache: "no-store",
      });
      if (!res.ok || !res.json) {
        setWorkflowError(res.error?.message ?? "Unable to load workflow");
        logMonetisationClientEvent("ops_alert_workflow_load_error", null, "ops", { code: res.error?.code ?? res.status });
        return;
      }
      const wf = res.json;
      if (wf?.ownership && typeof wf.ownership === "object") setOwnership(wf.ownership as any);
      if (wf?.snoozes && typeof wf.snoozes === "object") setSnoozes(wf.snoozes as any);
    } catch {
      setWorkflowError("Unable to load workflow");
      logMonetisationClientEvent("ops_alert_workflow_load_error", null, "ops", { code: "NETWORK" });
    } finally {
      setWorkflowLoading(false);
    }
  };

  useEffect(() => {
    (data?.alerts ?? []).forEach((alert) => {
      if (handledViewLogged.current.has(alert.key)) return;
      handledViewLogged.current.add(alert.key);
      logMonetisationClientEvent("ops_alert_handled_view", null, "ops", { alertKey: alert.key });
    });
  }, [data?.alerts]);

  useEffect(() => {
    loadWorkflow();
  }, []);

  useEffect(() => {
    // sync acknowledged state when handled delivered from server
    const updated: Record<string, { acknowledged: boolean; requestId?: string | null }> = {};
    (data?.recentEvents ?? []).forEach((ev) => {
      if (ev?.handled) updated[ev.id] = { acknowledged: true, requestId: null };
    });
    if (Object.keys(updated).length) setAckState((prev) => ({ ...prev, ...updated }));
  }, [data?.recentEvents]);

  useEffect(() => {
    setHandoffNotes((prev) => {
      const next = { ...prev };
      Object.entries(ownership ?? {}).forEach(([key, value]) => {
        if (value?.note) next[key] = value.note;
      });
      return next;
    });
  }, [ownership]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (testEvents.length && !ackViewLogged.current) {
      ackViewLogged.current = true;
      logMonetisationClientEvent("ops_alerts_ack_view", null, "ops", { meta: { window: windowLabel } });
    }
  }, [testEvents.length, windowLabel]);

  useEffect(() => {
    if (deliveryViewLogged.current) return;
    const hasDelivery = (data?.recentEvents ?? []).some((ev: any) => ev?.delivery);
    if (hasDelivery) {
      deliveryViewLogged.current = true;
      logMonetisationClientEvent("ops_alerts_delivery_view", null, "ops", { meta: { window: windowLabel } });
    }
  }, [data?.recentEvents, windowLabel]);


  useEffect(() => {
    if (testCooldownSeconds <= 0) {
      if (cooldownKeyRef.current && typeof window !== "undefined") {
        window.sessionStorage.removeItem(cooldownKeyRef.current);
      }
      if (cooldownLoggedRef.current) {
        logMonetisationClientEvent("ops_alerts_test_cooldown_ended", null, "ops", { meta: { window: windowLabel } });
        cooldownLoggedRef.current = false;
      }
      return;
    }
    if (!cooldownLoggedRef.current) {
      cooldownLoggedRef.current = true;
    }
    const id = window.setInterval(() => setTestCooldownSeconds((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(id);
  }, [testCooldownSeconds, windowLabel]);

  const handledLabel = (handled?: { source?: string | null }) => {
    if (!handled) return null;
    const source = handled.source ? handled.source.replace(/^\w/, (c) => c.toUpperCase()) : "UI";
    return `Handled (${source})`;
  };

  const deliveryBadge = (delivery?: { status?: string; maskedReason?: string | null }) => {
    if (!delivery?.status) return null;
    const status = delivery.status;
    const tone =
      status === "delivered"
        ? "bg-emerald-100 text-emerald-800"
        : status === "failed"
          ? "bg-rose-100 text-rose-800"
          : "bg-amber-100 text-amber-800";
    const label = status === "delivered" ? "Delivered" : status === "failed" ? "Failed" : "Sent";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
        {label}
        {status === "failed" && delivery.maskedReason ? ` · ${delivery.maskedReason}` : ""}
      </span>
    );
  };

  const headlineTone = useMemo(() => {
    if (!data) return { label: "Unavailable", className: "bg-slate-100 text-slate-700" };
    if ((data.alerts ?? []).length === 0) return { label: "Green", className: "bg-emerald-100 text-emerald-800" };
    const hasHigh = (data.alerts ?? []).some((a) => a?.state === "firing" && a?.severity === "high");
    return hasHigh
      ? { label: "Red", className: "bg-rose-100 text-rose-800" }
      : { label: "Amber", className: "bg-amber-100 text-amber-800" };
  }, [data]);

  const fetchLatestAlerts = useCallback(
    async ({
      reason,
      targetTab,
      silent,
    }: {
      reason: "manual" | "tab" | "test" | "ack" | "poll";
      targetTab?: "firing" | "recent";
      silent?: boolean;
    }): Promise<OpsAlertsModel | null> => {
      const activeTab = targetTab ?? tab;
      const loadedAt = new Date().toISOString();
      if (!silent) {
        setLoading(true);
      }
      if (reason === "manual") {
        setFlash(null);
        logMonetisationClientEvent("ops_alerts_refresh_click", null, "ops");
      }
      try {
        const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts", { method: "GET", cache: "no-store" });
        if (res.status === 429 || res.error?.code === "RATE_LIMITED") {
          if (!silent) {
            const retrySeconds = 30;
            setCooldown(retrySeconds);
            setError({ message: "Rate limited — try again shortly", requestId: res.requestId ?? null });
            logMonetisationClientEvent("ops_panel_rate_limited", null, "ops", { panel: "alerts", retryAfterSeconds: retrySeconds });
          }
          return null;
        }
        if (!res.ok || !res.json) {
          if (!silent) {
            setError({ message: res.error?.message ?? "Unable to load alerts", requestId: res.requestId ?? null });
            logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "alerts", code: res.error?.code ?? "UNKNOWN" });
            logMonetisationClientEvent("ops_alerts_load_error", null, "ops", {
              meta: { code: res.error?.code ?? "UNKNOWN", status: res.status, hasJson: Boolean(res.json), mode: "refresh" },
            });
            setLoadState("error");
          }
          return null;
        }
        const nextData = coerceOpsAlertsModel(res.json);
        setData(nextData);
        setError(null);
        setLoadState("ok");
        if (!silent) {
          logMonetisationClientEvent("ops_alerts_load_ok", null, "ops");
        }
        markLastLoaded(activeTab, loadedAt);
        return nextData;
      } catch {
        if (!silent) {
          setError({ message: "Unable to load alerts", requestId: null });
          logMonetisationClientEvent("ops_panel_fetch_error", null, "ops", { panel: "alerts", code: "NETWORK" });
          logMonetisationClientEvent("ops_alerts_load_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false, mode: "refresh" } });
          setLoadState("error");
        }
        return null;
      } finally {
        if (!silent) {
          setLoading(false);
        }
        setLastCheckedAtIso(loadedAt);
      }
    },
    [markLastLoaded, tab]
  );

  const refresh = async () => fetchLatestAlerts({ reason: "manual", targetTab: tab });

  useEffect(() => {
    const prev = previousTabRef.current;
    if (tab === "recent" && prev !== "recent") {
      fetchLatestAlerts({ reason: "tab", targetTab: "recent" });
    }
    previousTabRef.current = tab;
  }, [fetchLatestAlerts, tab]);

  const stopTestPoll = useCallback(
    ({
      found,
      attempts,
      surface,
      announce = true,
    }: {
      found: boolean;
      attempts?: number;
      surface?: "test_events" | "recent";
      announce?: boolean;
    }) => {
      const current = pollRef.current;
      if (!current) return;
      if (current.timer) {
        window.clearInterval(current.timer);
      }
      const totalAttempts = typeof attempts === "number" ? attempts : current.attempts;
      pollRef.current = null;
      setPollHint(null);
      logMonetisationClientEvent("ops_alerts_test_poll_stop", null, "ops", {
        meta: { window: windowLabel, attempts: totalAttempts, found },
      });
      if (found && surface) {
        logMonetisationClientEvent("ops_alerts_test_poll_found", null, "ops", {
          meta: { window: windowLabel, attempts: totalAttempts, surface },
        });
      }
      if (announce) {
        setFlash(found ? "Test alert recorded." : "Sent. If it doesn't appear, hit Refresh.");
      }
    },
    [windowLabel]
  );

  const startTestPoll = async (eventId: string) => {
    stopTestPoll({ found: false, announce: false });
    const maxAttempts = 6;
    const intervalMs = 1500;
    pollRef.current = { timer: null, attempts: 0, eventId, running: false };
    setPollHint("Waiting for event to appear...");
    logMonetisationClientEvent("ops_alerts_test_poll_start", null, "ops", {
      meta: { window: windowLabel, maxAttempts, intervalMs },
    });

    const runAttempt = async () => {
      const current = pollRef.current;
      if (!current || current.running) return;
      current.running = true;
      current.attempts += 1;
      const attempt = current.attempts;
      const nextData = await fetchLatestAlerts({ reason: "poll", targetTab: "recent", silent: true });
      const match = nextData?.recentEvents?.find((ev) => ev?.id === eventId);
      const found = Boolean(match);
      current.running = false;
      if (!pollRef.current) return;
      if (found) {
        const surface = match?.isTest ? "test_events" : "recent";
        stopTestPoll({ found: true, attempts: attempt, surface });
        return;
      }
      if (attempt >= maxAttempts) {
        stopTestPoll({ found: false, attempts: attempt });
      }
    };

    await runAttempt();
    if (pollRef.current) {
      pollRef.current.timer = window.setInterval(runAttempt, intervalMs);
    }
  };

  useEffect(() => {
    if (tab !== "recent") {
      stopTestPoll({ found: false, announce: false });
    }
  }, [stopTestPoll, tab]);

  useEffect(() => {
    return () => {
      stopTestPoll({ found: false, announce: false });
    };
  }, [stopTestPoll]);

  const sendTest = async () => {
    if (testSending || testCooldownSeconds > 0) return;
    setFlash(null);
    setPollHint(null);
    stopTestPoll({ found: false, announce: false });
    setError(null);
    setTestSending(true);
    logMonetisationClientEvent("ops_alerts_test_click", null, "ops");
    logMonetisationClientEvent("ops_alerts_test_send_click", null, "ops", { meta: { window: windowLabel } });
    logMonetisationClientEvent("ops_alerts_test_send_clicked", null, "ops", { meta: { window: windowLabel } });
    try {
      const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts/test", { method: "POST", cache: "no-store" });
      if (res.status === 429 || res.error?.code === "RATE_LIMITED") {
        const retrySeconds = 30;
        setCooldown(retrySeconds);
        setError({ message: "Rate limited — try again shortly", requestId: res.requestId ?? null });
        setLoadState("error");
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
      const eventId = (res.json as any).eventId ?? null;
      const hasEventId = Boolean(eventId);
      logMonetisationClientEvent("ops_alerts_test_success", null, "ops", { meta: { eventId: (res.json as any).eventId ?? null } });
      logMonetisationClientEvent("ops_alerts_test_sent_success", null, "ops", { meta: { window: windowLabel, hasEventId } });
      if ((res.json as any)?.deduped) {
        logMonetisationClientEvent("ops_alerts_test_sent_deduped", null, "ops", { meta: { window: windowLabel, hasEventId } });
      }
      const wasRecent = tab === "recent";
      if (!wasRecent) setTab("recent");
      setTestEventsOpen(true);
      logMonetisationClientEvent("ops_alerts_test_events_auto_expand", null, "ops", { meta: { window: windowLabel, reason: "test_sent" } });
      window.setTimeout(() => {
        if (testEventsRef.current) testEventsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
      const until = Date.now() + 10_000;
      if (cooldownKeyRef.current && typeof window !== "undefined") {
        window.sessionStorage.setItem(cooldownKeyRef.current, `${until}`);
      }
      setTestCooldownSeconds(10);
      cooldownLoggedRef.current = false;
      logMonetisationClientEvent("ops_alerts_test_cooldown_started", null, "ops", { meta: { window: windowLabel, seconds: 10 } });
      if (eventId) {
        startTestPoll(eventId);
      } else {
        setFlash("Test alert recorded.");
        fetchLatestAlerts({ reason: "test", targetTab: "recent" });
      }
    } catch {
      setError({ message: "Test alert failed", requestId: null });
      logMonetisationClientEvent("ops_alerts_test_error", null, "ops", { meta: { code: "NETWORK", status: 0, hasJson: false } });
      setLoadState("error");
    } finally {
      setTestSending(false);
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

  const applyHandledToData = (eventId: string, handledMeta: { at: string; source?: string | null }) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextEvents = (prev.recentEvents ?? []).map((ev) => (ev?.id === eventId ? { ...ev, handled: handledMeta } : ev));
      return { ...prev, recentEvents: nextEvents };
    });
  };

  const acknowledgeEvent = async (event: any) => {
    if (!event?.id) return;
    logMonetisationClientEvent("ops_alerts_ack_click", null, "ops", {
      meta: { eventIdHash: typeof event.id === "string" ? event.id.slice(0, 8) : "unknown", window_label: event.window ?? "15m", isTest: Boolean(event.isTest) },
    });
    try {
      const tokenRes = await fetchJsonSafe<{ token: string; requestId?: string | null; ttlSeconds?: number }>(`/api/ops/alerts/ack-token`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      if (!tokenRes.ok || !tokenRes.json?.token) {
        setError({ message: tokenRes.error?.message ?? "Unable to acknowledge alert", requestId: tokenRes.requestId ?? null });
        return;
      }
      const token = tokenRes.json.token;
      const ackRes = await fetchJsonSafe<{ ok: boolean; deduped?: boolean; requestId?: string | null }>(`/api/alerts/ack`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!ackRes.ok || !ackRes.json?.ok) {
        setError({ message: ackRes.error?.message ?? "Unable to acknowledge alert", requestId: ackRes.requestId ?? tokenRes.requestId ?? null });
        logMonetisationClientEvent("ops_alerts_ack_public_error", null, "ops", {
          meta: { code: ackRes.error?.code ?? "ACK_FAILED", deduped: Boolean(ackRes.json?.deduped) },
        });
        return;
      }
      const handledMeta = event?.handled?.at
        ? { at: event.handled.at, source: event.handled.source ?? "ui" }
        : { at: new Date().toISOString(), source: "ui" };
      applyHandledToData(event.id, handledMeta);
      setAckState((prev) => ({ ...prev, [event.id]: { acknowledged: true, requestId: ackRes.requestId ?? tokenRes.requestId ?? null } }));
      logMonetisationClientEvent("ops_alerts_ack_public_success", null, "ops", {
        meta: { deduped: Boolean(ackRes.json?.deduped) },
      });
      logMonetisationClientEvent("ops_alerts_ack_ui_state_change", null, "ops", { meta: { acknowledged: true } });
      if (ackRes.json?.deduped) {
        setFlash("Already acknowledged.");
      }
      await fetchLatestAlerts({ reason: "ack", targetTab: tab, silent: true });
    } catch {
      setError({ message: "Unable to acknowledge alert", requestId: null });
    }
  };

  const copyAckLink = (token: string, meta: { window_label?: string | null; isTest?: boolean; eventId?: string }) => {
    const link = buildAckLink(token, { returnTo: "/app/ops/alerts" });
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(link);
    logMonetisationClientEvent("ops_alerts_ack_link_copy", null, "ops", {
      meta: { window_label: meta.window_label ?? "15m", isTest: Boolean(meta.isTest), eventIdHash: meta.eventId ? meta.eventId.slice(0, 8) : "unknown" },
    });
  };

  const claimAlert = async (alert: Alert) => {
    logMonetisationClientEvent("ops_alert_claim_click", null, "ops", { alertKey: alert.key });
    try {
      const res = await fetchJsonSafe<any>("/api/ops/alerts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.key, windowLabel: OWNERSHIP_WINDOW, eventId: alert.signals?.eventId ?? null, note: alert.signals?.handoffNote ?? null }),
      });
      if (!res.ok || !res.json) {
        logMonetisationClientEvent("ops_alert_claim_error", null, "ops", { alertKey: alert.key, code: res.error?.code ?? res.status });
        setWorkflowError(res.error?.message ?? "Unable to claim");
        return;
      }
      const info = res.json?.ownership;
      setOwnership((prev) => ({
        ...prev,
        [alert.key]: {
          claimedByUserId: info?.claimedBy ?? (data as any)?.currentUserId ?? "",
          claimedAt: info?.claimedAt ?? new Date().toISOString(),
          expiresAt: info?.expiresAt ?? new Date().toISOString(),
          eventId: info?.eventId ?? null,
          note: info?.note ?? null,
        },
      }));
      logMonetisationClientEvent("ops_alert_claim_success", null, "ops", { alertKey: alert.key });
    } catch {
      logMonetisationClientEvent("ops_alert_claim_error", null, "ops", { alertKey: alert.key, code: "NETWORK" });
      setWorkflowError("Unable to claim");
    }
  };

  const releaseAlert = async (alert: Alert) => {
    logMonetisationClientEvent("ops_alert_release_click", null, "ops", { alertKey: alert.key });
    try {
      const res = await fetchJsonSafe<any>("/api/ops/alerts/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.key, windowLabel: OWNERSHIP_WINDOW }),
      });
      if (!res.ok || !res.json) {
        logMonetisationClientEvent("ops_alert_release_error", null, "ops", { alertKey: alert.key, code: res.error?.code ?? res.status });
        setWorkflowError(res.error?.message ?? "Unable to release");
        return;
      }
      setOwnership((prev) => {
        const next = { ...prev };
        delete next[alert.key];
        return next;
      });
      logMonetisationClientEvent("ops_alert_release_success", null, "ops", { alertKey: alert.key });
    } catch {
      logMonetisationClientEvent("ops_alert_release_error", null, "ops", { alertKey: alert.key, code: "NETWORK" });
      setWorkflowError("Unable to release");
    }
  };

  const snooze = async (alert: Alert, minutes: number) => {
    logMonetisationClientEvent("ops_alert_snooze_click", null, "ops", { alertKey: alert.key, minutes });
    try {
      const res = await fetchJsonSafe<any>("/api/ops/alerts/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.key, windowLabel: OWNERSHIP_WINDOW, minutes }),
      });
      if (!res.ok || !res.json) {
        logMonetisationClientEvent("ops_alert_snooze_error", null, "ops", { alertKey: alert.key, code: res.error?.code ?? res.status });
        setWorkflowError(res.error?.message ?? "Unable to snooze");
        return;
      }
      const sn = res.json?.snooze;
      setSnoozes((prev) => ({
        ...prev,
        [alert.key]: {
          snoozedByUserId: sn?.snoozedBy ?? (data as any)?.currentUserId ?? "",
          snoozedAt: sn?.snoozedAt ?? new Date().toISOString(),
          untilAt: sn?.untilAt ?? new Date().toISOString(),
          reason: sn?.reason ?? null,
        },
      }));
      logMonetisationClientEvent("ops_alert_snooze_success", null, "ops", { alertKey: alert.key, minutes });
    } catch {
      logMonetisationClientEvent("ops_alert_snooze_error", null, "ops", { alertKey: alert.key, code: "NETWORK" });
      setWorkflowError("Unable to snooze");
    }
  };

  const unsnooze = async (alert: Alert) => {
    logMonetisationClientEvent("ops_alert_unsnooze_click", null, "ops", { alertKey: alert.key });
    try {
      const res = await fetchJsonSafe<any>("/api/ops/alerts/unsnooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.key, windowLabel: OWNERSHIP_WINDOW }),
      });
      if (!res.ok || !res.json) {
        logMonetisationClientEvent("ops_alert_unsnooze_error", null, "ops", { alertKey: alert.key, code: res.error?.code ?? res.status });
        setWorkflowError(res.error?.message ?? "Unable to unsnooze");
        return;
      }
      setSnoozes((prev) => {
        const next = { ...prev };
        delete next[alert.key];
        return next;
      });
      logMonetisationClientEvent("ops_alert_unsnooze_success", null, "ops", { alertKey: alert.key });
    } catch {
      logMonetisationClientEvent("ops_alert_unsnooze_error", null, "ops", { alertKey: alert.key, code: "NETWORK" });
      setWorkflowError("Unable to unsnooze");
    }
  };

  const saveHandoff = async (alert: Alert, note: string) => {
    const sanitized = note.replace(/\s+/g, " ").trim().slice(0, 280).replace(/https?:\/\/\S+/gi, "[url-redacted]");
    try {
      await fetchJsonSafe<any>("/api/ops/alerts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey: alert.key, windowLabel: OWNERSHIP_WINDOW, note: sanitized, eventId: alert.signals?.eventId ?? null }),
      });
      setOwnership((prev) => ({
        ...prev,
        [alert.key]: prev[alert.key] ? { ...prev[alert.key], note: sanitized } : prev[alert.key],
      }));
      logMonetisationClientEvent("ops_alert_handoff_note_save", null, "ops", { alertKey: alert.key, length: sanitized.length });
    } catch {
      logMonetisationClientEvent("ops_alert_handoff_note_save", null, "ops", { alertKey: alert.key, length: sanitized.length, code: "NETWORK" });
    }
  };

  const renderAlertCard = (alert: Alert) => {
    const handledInfo = handled[alert.key];
    const handledRecent = handledInfo ? Date.now() - new Date(handledInfo.at).getTime() < HANDLED_COOLDOWN_MS : false;
    const note = handledNotes[alert.key] ?? "";
    const handledError = handledErrors[alert.key] ?? null;
    const ownershipInfo = ownership[alert.key];
    const snoozeInfo = snoozes[alert.key];
    const now = new Date();
    const claimedByMe = ownershipInfo?.claimedByUserId === (data as any)?.currentUserId;
    const claimed = ownershipInfo && new Date(ownershipInfo.expiresAt).getTime() > now.getTime();
    const snoozed = snoozeInfo && new Date(snoozeInfo.untilAt).getTime() > now.getTime();
    const eventId = typeof (alert as any)?.signals?.eventId === "string" ? (alert as any).signals.eventId : null;
    const eventAcknowledged = eventId ? Boolean(ackState[eventId]?.acknowledged) : false;
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
              href={
                ownershipInfo && claimedByMe && action.kind === "incidents"
                  ? `${action.href}${action.href.includes("?") ? "&" : "?"}claimed=me`
                  : action.href
              }
              onClick={() => logMonetisationClientEvent("ops_alert_action_click", null, "ops", { key: alert.key, actionKind: action.kind ?? null })}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
        <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Ownership</p>
            {claimed && ownershipInfo ? (
              <span className="text-[11px] text-[rgb(var(--muted))]">
                Claimed by {ownershipInfo.claimedByUserId === (data as any)?.currentUserId ? "me" : ownershipInfo.claimedByUserId} until{" "}
                {formatShortLocalTime(ownershipInfo.expiresAt)}
              </span>
            ) : (
              <span className="text-[11px] text-[rgb(var(--muted))]">{workflowLoading ? "Loading…" : "Unclaimed"}</span>
            )}
          </div>
          {ownershipInfo?.note ? (
            <details className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-[11px] text-[rgb(var(--muted))]">
              <summary className="cursor-pointer text-[rgb(var(--ink))]">Handoff note</summary>
              <p className="mt-1 whitespace-pre-line">{ownershipInfo.note}</p>
            </details>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!claimed ? (
              <button
                type="button"
                className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                onClick={() => claimAlert(alert)}
                disabled={workflowLoading}
              >
                Claim
              </button>
            ) : claimedByMe ? (
              <>
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => releaseAlert(alert)}
                  disabled={workflowLoading}
                >
                  Release
                </button>
                <input
                  type="text"
                  maxLength={280}
                  value={handoffNotes[alert.key] ?? ownershipInfo?.note ?? ""}
                  placeholder="Add handoff note (masked, optional)"
                  onChange={(e) => setHandoffNotes((prev) => ({ ...prev, [alert.key]: e.target.value }))}
                  onBlur={(e) => saveHandoff(alert, e.target.value)}
                  className="flex-1 rounded-md border border-black/10 px-3 py-1 text-sm"
                />
              </>
            ) : (
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--muted))]"
                disabled
              >
                Claimed
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {snoozed ? (
              <>
                <span className="text-[11px] text-[rgb(var(--muted))]">Snoozed until {formatShortLocalTime(snoozeInfo?.untilAt)}</span>
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => unsnooze(alert)}
                  disabled={workflowLoading}
                >
                  Unsnooze
                </button>
              </>
            ) : (
              SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => snooze(alert, opt.minutes)}
                  disabled={workflowLoading}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
          {workflowError ? <p className="text-[11px] text-rose-700">{workflowError}</p> : null}
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
          {eventId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => acknowledgeEvent({ ...alert, id: eventId, window: "15m", isTest: false })}
                disabled={eventAcknowledged}
                className="rounded-full border border-black/10 px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] disabled:opacity-50"
              >
                {eventAcknowledged ? "Acknowledged" : "Acknowledge"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const tokenRes = await fetchJsonSafe<{ token: string }>(`/api/ops/alerts/ack-token`, {
                    method: "POST",
                    cache: "no-store",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ eventId }),
                  });
                  if (!tokenRes.ok || !tokenRes.json?.token) {
                    setError({ message: tokenRes.error?.message ?? "Unable to copy ACK link", requestId: tokenRes.requestId ?? null });
                    logMonetisationClientEvent("ops_alerts_ack_token_mint_error", null, "ops", {
                      meta: { hasSecret: Boolean(process.env.ALERTS_ACK_SECRET) },
                    });
                    return;
                  }
                  copyAckLink(tokenRes.json.token, { window_label: "15m", isTest: false, eventId });
                }}
                className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
              >
                Copy ACK link
              </button>
              <button
                type="button"
                onClick={() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const cmd = `curl -X POST -H "Content-Type: application/json" -d '{\"eventId\":\"${eventId}\",\"source\":\"webhook\"}' ${origin}/api/ops/alerts/ack`;
                  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cmd);
                  logMonetisationClientEvent("ops_alerts_ack_curl_copy", null, "ops", { meta: { window: windowLabel } });
                }}
                className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
              >
                Copy ACK curl (for integrations)
              </button>
              {ackState[eventId]?.acknowledged ? (
                <span className="text-[10px] text-emerald-700">Ack recorded ({ackState[eventId]?.requestId ?? "no request id"})</span>
              ) : null}
            </div>
          ) : null}
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
          <p className="text-[11px] text-[rgb(var(--muted))]">ACK marks an alert as seen/handled and prevents duplicate noise.</p>
          {data?.webhookConfig && data.webhookConfig.mode === "disabled" ? (
            <p className="text-[11px] text-[rgb(var(--muted))]">Webhook notifications disabled.</p>
          ) : !data?.webhookConfigured ? (
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
            className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
            disabled={loading || testSending || testCooldownSeconds > 0}
          >
            {testSending ? "Sending…" : testCooldownSeconds > 0 ? `Try again in ${testCooldownSeconds}s` : "Send test alert"}
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
        {pollHint ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">{pollHint}</p> : null}
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
      <div className="text-[11px] text-[rgb(var(--muted))]">
        <span>Firing last loaded: {lastLoadedFiringAt ? formatShortLocalTime(lastLoadedFiringAt) : "--"}</span>
        <span className="mx-2">·</span>
        <span>Recent last loaded: {lastLoadedRecentAt ? formatShortLocalTime(lastLoadedRecentAt) : "--"}</span>
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
                    <th className="px-2 py-1">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {normalEvents.map((ev) => {
                    const acknowledged = Boolean(ev?.handled?.at) || Boolean(ackState[ev.id]?.acknowledged);
                    return (
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
                      <td className="px-2 py-1">
                        <span className="block">{ev.summary}</span>
                        {ev.handled ? (
                          <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            {handledLabel(ev.handled)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        {deliveryBadge(ev.delivery)}
                        {ev.delivery?.status === "failed" ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {ev.delivery.providerRef ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(String(ev.delivery.providerRef));
                                  logMonetisationClientEvent("ops_alerts_delivery_copy_ref", null, "ops", { meta: { window: windowLabel } });
                                }}
                                className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                              >
                                Copy delivery ref
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                const snippet = `Delivery failed for ${ev.key} (${ev.id ?? "event"}) · reason ${ev.delivery?.maskedReason ?? "unknown"}. Please check webhook endpoint.`;
                                if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(snippet);
                                logMonetisationClientEvent("ops_alerts_delivery_copy_ref", null, "ops", { meta: { window: windowLabel, type: "support" } });
                              }}
                              className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                            >
                              Copy support snippet
                            </button>
                          </div>
                        ) : null}
                        {ev.id ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => acknowledgeEvent(ev)}
                              disabled={acknowledged}
                              className="rounded-full border border-black/10 px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] disabled:opacity-50"
                            >
                              {acknowledged ? "Acknowledged" : "Acknowledge"}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const tokenRes = await fetchJsonSafe<{ token: string }>(`/api/ops/alerts/ack-token`, {
                                  method: "POST",
                                  cache: "no-store",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({ eventId: ev.id }),
                                });
                                if (!tokenRes.ok || !tokenRes.json?.token) {
                                  setError({ message: tokenRes.error?.message ?? "Unable to copy ACK link", requestId: tokenRes.requestId ?? null });
                                  logMonetisationClientEvent("ops_alerts_ack_token_mint_error", null, "ops", {
                                    meta: { hasSecret: Boolean(process.env.ALERTS_ACK_SECRET) },
                                  });
                                  return;
                                }
                                copyAckLink(tokenRes.json.token, { window_label: ev.window ?? "15m", isTest: Boolean(ev.isTest), eventId: ev.id });
                              }}
                              className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                            >
                              Copy ACK link
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== "undefined" ? window.location.origin : "";
                                const cmd = `curl -X POST -H "Content-Type: application/json" -d '{\"eventId\":\"${ev.id}\",\"source\":\"webhook\"}' ${origin}/api/ops/alerts/ack`;
                                if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cmd);
                                logMonetisationClientEvent("ops_alerts_ack_curl_copy", null, "ops", { meta: { window: windowLabel } });
                              }}
                              className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                            >
                              Copy ACK curl (for integrations)
                            </button>
                            {ackState[ev.id]?.acknowledged ? (
                              <span className="text-[10px] text-emerald-700">Ack recorded ({ackState[ev.id]?.requestId ?? "no request id"})</span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[rgb(var(--muted))]">No recent alert events.</p>
            )}
          </div>
          {testEvents.length ? (
            <div ref={testEventsRef} className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
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
              <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">Use Acknowledge to confirm the end-to-end loop (no terminal needed).</p>
              {testEventsOpen ? (
                <ul className="mt-2 space-y-2">
                  {testEvents.map((ev) => {
                    const acknowledged = Boolean(ev?.handled?.at) || Boolean(ackState[ev.id]?.acknowledged);
                    const auditsHref = ev.signals?.requestId
                      ? `/app/ops/audits?requestId=${encodeURIComponent(ev.signals.requestId)}`
                      : `/app/ops/audits?q=${encodeURIComponent(ev.id ?? ev.key ?? "ops_alert_test")}`;
                    return (
                      <li key={ev.id} className="rounded-lg border border-black/5 bg-white px-3 py-2 text-xs text-[rgb(var(--muted))]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[rgb(var(--ink))]">
                              {formatShortLocalTime(ev.at)} · {ev.summary}
                            </p>
                            {ev.handled ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{handledLabel(ev.handled)}</span>
                            ) : null}
                            {deliveryBadge(ev.delivery)}
                          </div>
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
                          {ev.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => acknowledgeEvent(ev)}
                                disabled={acknowledged}
                                className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                {acknowledged ? "Acknowledged" : "Acknowledge"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const tokenRes = await fetchJsonSafe<{ token: string }>(`/api/ops/alerts/ack-token`, {
                                    method: "POST",
                                    cache: "no-store",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ eventId: ev.id }),
                                  });
                                  if (!tokenRes.ok || !tokenRes.json?.token) {
                                    setError({ message: tokenRes.error?.message ?? "Unable to copy ACK link", requestId: tokenRes.requestId ?? null });
                                    logMonetisationClientEvent("ops_alerts_ack_token_mint_error", null, "ops", {
                                      meta: { hasSecret: Boolean(process.env.ALERTS_ACK_SECRET) },
                                    });
                                    return;
                                  }
                                  copyAckLink(tokenRes.json.token, { window_label: ev.window ?? "15m", isTest: true, eventId: ev.id });
                                }}
                                className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                              >
                                Copy ACK link
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                                  const cmd = `curl -X POST -H "Content-Type: application/json" -d '{\"eventId\":\"${ev.id}\",\"source\":\"webhook\"}' ${origin}/api/ops/alerts/ack`;
                                  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cmd);
                                  logMonetisationClientEvent("ops_alerts_ack_curl_copy", null, "ops", { meta: { window: windowLabel } });
                                }}
                                className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                              >
                                Copy ACK curl (for integrations)
                              </button>
                              {ackState[ev.id]?.acknowledged ? (
                                <span className="text-[10px] text-emerald-700">Ack recorded ({ackState[ev.id]?.requestId ?? "no request id"})</span>
                              ) : null}
                            </>
                          ) : null}
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
