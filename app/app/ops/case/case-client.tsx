"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { coerceOpsAlertsModel, type OpsAlertsModel } from "@/lib/ops/alerts-model";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { parseOpsCaseInput, type OpsCaseSearchMode } from "@/lib/ops/ops-case-parse";
import { buildCaseKey, resolveCaseWindow, type CaseWindow } from "@/lib/ops/ops-case-model";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  buildOpsCaseAlertsLink,
  buildOpsCaseAuditsLink,
  buildOpsCaseIncidentsLink,
  buildOpsCaseResolutionsLink,
  buildOpsCaseStatusLink,
  buildOpsCaseWebhooksLink,
} from "@/lib/ops/ops-case-links";
import { groupIncidents, type IncidentRecord } from "@/lib/ops/incidents-shared";

type Props = {
  initialQuery: { requestId: string | null; userId: string | null; email: string | null; window: string | null; from: string | null; q?: string | null };
  requestId: string | null;
  viewerRole: ViewerRole;
};

type ViewerRole = "user" | "support" | "admin" | "super_admin";

type AuditItem = {
  id: string;
  at: string;
  action: string;
  actor?: { email?: string | null; role?: string | null } | null;
  requestId?: string | null;
  ref?: string | null;
  meta?: Record<string, any>;
};

type WebhookFailure = {
  id: string;
  requestId: string | null;
  at: string;
  code: string | null;
  summary: string | null;
  repeatCount: number;
  eventIdHash?: string | null;
  groupKeyHash?: string | null;
};

type BillingSnapshot = {
  local?: { subscriptionStatus?: string; creditsAvailable?: number; lastBillingEvent?: { kind?: string; at?: string | null; requestId?: string | null } | null };
  delayState?: { state?: string; message?: string };
  webhookHealth?: { status?: string };
  requestId?: string | null;
};

type MaskedOutcome = {
  id: string | null;
  code: string;
  createdAt: string;
  requestId: string | null;
  userId: string | null;
  actorMasked: string | null;
  noteMasked: string | null;
  effectivenessState: string;
};

type WatchRecord = {
  requestId: string;
  userId?: string | null;
  reasonCode: string;
  note?: string | null;
  createdAt: string;
  expiresAt: string;
  createdBy?: string | null;
};

type CaseContext = {
  requestId: string;
  userId: string | null;
  emailMasked: string | null;
  sources: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenPath?: string | null;
};

const WINDOW_OPTIONS: Array<{ value: CaseWindow; label: string }> = [
  { value: "15m", label: "15m" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

function maskId(value?: string | null) {
  if (!value) return null;
  if (value.length <= 6) return `${value[0] ?? ""}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function buildCaseSnippet({
  requestId,
  userId,
  emailMasked,
  contextSources,
  contextLastSeenAt,
  window,
  latestAlertEventId,
  latestWebhookRef,
  billingRequestId,
}: {
  requestId?: string | null;
  userId?: string | null;
  emailMasked?: string | null;
  contextSources?: string[] | null;
  contextLastSeenAt?: string | null;
  window: CaseWindow;
  latestAlertEventId?: string | null;
  latestWebhookRef?: string | null;
  billingRequestId?: string | null;
}) {
  const lines = ["CVForge Ops Case", `Window: ${window}`];
  if (requestId) lines.push(`RequestId: ${requestId}`);
  if (userId) lines.push(`UserId: ${maskId(userId)}`);
  if (emailMasked) lines.push(`Email: ${emailMasked}`);
  if (contextSources && contextSources.length) lines.push(`Context sources: ${contextSources.join(", ")}`);
  if (contextLastSeenAt) lines.push(`Context last seen: ${formatShortLocalTime(contextLastSeenAt)}`);
  if (latestAlertEventId) lines.push(`Latest alert event: ${latestAlertEventId}`);
  if (latestWebhookRef) lines.push(`Webhook ref: ${latestWebhookRef}`);
  if (billingRequestId) lines.push(`Billing requestId: ${billingRequestId}`);
  lines.push("Checklist:");
  lines.push("- Opened Alerts and confirmed event visible");
  lines.push("- Acknowledged alert (yes/no)");
  lines.push("- Opened Audits/Incidents filtered by requestId");
  lines.push("Outcome: ");
  return lines.join("\n");
}

export default function CaseClient({ initialQuery, requestId, viewerRole }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeLog = useCallback((event: string, meta?: Record<string, any>) => {
    try {
      logMonetisationClientEvent(event as any, null, "ops", meta ?? undefined);
    } catch {
      // ignore
    }
  }, []);

  const requestIdRaw = searchParams?.get("requestId") ?? initialQuery.requestId ?? null;
  const userIdRaw = searchParams?.get("userId") ?? initialQuery.userId ?? null;
  const emailRaw = searchParams?.get("email") ?? initialQuery.email ?? null;
  const qRaw = searchParams?.get("q") ?? initialQuery.q ?? null;
  const requestIdParamRaw = normaliseId(requestIdRaw) || null;
  const userIdParamRaw = normaliseId(userIdRaw) || null;
  const emailParamRaw = normaliseId(emailRaw) || null;
  const fromParam = searchParams?.get("from") ?? initialQuery.from ?? null;
  const windowParam = resolveCaseWindow(searchParams?.get("window") ?? initialQuery.window);
  const fallbackFromQ = qRaw ? parseOpsCaseInput(qRaw, "requestId") : null;
  const qFallbackRequestId =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "requestId" ? fallbackFromQ.value : null;
  const qFallbackUserId =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "userId" ? fallbackFromQ.value : null;
  const qFallbackEmail =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "email" ? fallbackFromQ.value : null;
  const resolvedRequestIdParam = requestIdParamRaw ?? qFallbackRequestId;
  const resolvedUserIdParam = userIdParamRaw ?? qFallbackUserId;
  const resolvedEmailParam = emailParamRaw ?? qFallbackEmail;
  const requestIdParam = resolvedRequestIdParam;
  const userIdParam = resolvedUserIdParam;
  const emailParam = resolvedEmailParam;

  const [input, setInput] = useState(resolvedRequestIdParam ?? resolvedUserIdParam ?? resolvedEmailParam ?? "");
  const [searchMode, setSearchMode] = useState<OpsCaseSearchMode>(resolvedUserIdParam ? "userId" : "requestId");
  const [windowValue, setWindowValue] = useState<CaseWindow>(windowParam);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [contextData, setContextData] = useState<CaseContext | null>(null);
  const [contextError, setContextError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [attachValue, setAttachValue] = useState("");
  const [attachNote, setAttachNote] = useState("");
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [attachSuccess, setAttachSuccess] = useState<string | null>(null);

  const [alertsData, setAlertsData] = useState<OpsAlertsModel>(() => coerceOpsAlertsModel(null));
  const [alertsError, setAlertsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [incidentsData, setIncidentsData] = useState<IncidentRecord[]>([]);
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [incidentsError, setIncidentsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const [auditsData, setAuditsData] = useState<AuditItem[]>([]);
  const [auditsError, setAuditsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [auditsLoading, setAuditsLoading] = useState(false);

  const [webhooksData, setWebhooksData] = useState<WebhookFailure[]>([]);
  const [webhooksError, setWebhooksError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  const [billingData, setBillingData] = useState<BillingSnapshot | null>(null);
  const [billingError, setBillingError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingRecheckHint, setBillingRecheckHint] = useState<string | null>(null);
  const [billingRecheckError, setBillingRecheckError] = useState<string | null>(null);
  const [billingRecheckLoading, setBillingRecheckLoading] = useState(false);

  const [outcomesData, setOutcomesData] = useState<MaskedOutcome[]>([]);
  const [outcomesError, setOutcomesError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);

  const [watchData, setWatchData] = useState<WatchRecord[]>([]);
  const [watchError, setWatchError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [watchLoading, setWatchLoading] = useState(false);

  const caseKey = useMemo(
    () => buildCaseKey({ requestId: resolvedRequestIdParam, userId: resolvedUserIdParam, email: resolvedEmailParam }),
    [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam]
  );
  const hasQuery = Boolean(resolvedRequestIdParam || resolvedUserIdParam || resolvedEmailParam);
  const effectiveUserId = resolvedUserIdParam ?? contextData?.userId ?? resolvedUserId;
  const effectiveEmailMasked = contextData?.emailMasked ?? (resolvedEmailParam ? maskEmail(resolvedEmailParam) : null);
  const isAdminViewer = viewerRole === "admin" || viewerRole === "super_admin";

  const alertsViewLogged = useRef<string | null>(null);
  const incidentsViewLogged = useRef<string | null>(null);
  const auditsViewLogged = useRef<string | null>(null);
  const webhooksViewLogged = useRef<string | null>(null);
  const billingViewLogged = useRef<string | null>(null);
  const resolutionViewLogged = useRef<string | null>(null);

  useEffect(() => {
    setInput(resolvedRequestIdParam ?? resolvedUserIdParam ?? resolvedEmailParam ?? "");
    if (resolvedUserIdParam) {
      setSearchMode("userId");
    } else if (resolvedRequestIdParam) {
      setSearchMode("requestId");
    }
    setWindowValue(windowParam);
  }, [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam, windowParam]);

  useEffect(() => {
    if (!resolvedEmailParam || resolvedUserIdParam) {
      setResolvedUserId(null);
      setResolveError(null);
      return;
    }
    let active = true;
    const lookup = async () => {
      setResolveError(null);
      const params = new URLSearchParams({ q: resolvedEmailParam });
      if (resolvedRequestIdParam) params.set("requestId", resolvedRequestIdParam);
      const res = await fetchJsonSafe<{ ok: boolean; users?: Array<{ id: string; email?: string | null }> }>(
        `/api/ops/users/search?${params.toString()}`,
        { method: "GET", cache: "no-store" }
      );
      if (!active) return;
      if (!res.ok || !res.json?.ok) {
        setResolveError(res.error?.message ?? "Unable to resolve user id");
        return;
      }
      const match = (res.json.users ?? []).find((u) => (u.email ?? "").toLowerCase() === resolvedEmailParam.toLowerCase());
      setResolvedUserId(match?.id ?? null);
    };
    lookup();
    return () => {
      active = false;
    };
  }, [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam]);

  useEffect(() => {
    if (!resolvedRequestIdParam) {
      setContextData(null);
      setContextError(null);
      setAttachSuccess(null);
      return;
    }
    let active = true;
    setContextLoading(true);
    setContextError(null);
    setContextData(null);
    const load = async () => {
      const res = await fetchJsonSafe<{ ok: boolean; context?: CaseContext | null }>(
        `/api/ops/case/context?requestId=${encodeURIComponent(resolvedRequestIdParam)}`,
        { method: "GET", cache: "no-store" }
      );
      if (!active) return;
      if (res.ok && res.json?.ok) {
        setContextData(res.json.context ?? null);
        setContextError(null);
      } else {
        setContextError({ message: res.error?.message ?? "Unable to load user context", requestId: res.requestId ?? requestId });
      }
      setContextLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [requestId, resolvedRequestIdParam]);

  const updateQuery = useCallback(
    (next: { requestId?: string | null; userId?: string | null; email?: string | null; window?: CaseWindow }) => {
      const params = new URLSearchParams();
      const windowNext = next.window ?? windowValue;
      if (windowNext) params.set("window", windowNext);
      if (next.requestId) params.set("requestId", normaliseId(next.requestId));
      if (next.userId) params.set("userId", normaliseId(next.userId));
      if (next.email) params.set("email", normaliseId(next.email));
      if (fromParam) params.set("from", fromParam);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fromParam, pathname, router, windowValue]
  );

  const handleSearch = useCallback(() => {
    const parsed = parseOpsCaseInput(input, searchMode);
    if (!parsed.value) return;
    const next: { requestId?: string | null; userId?: string | null; email?: string | null; window?: CaseWindow } = { window: windowValue };
    if (parsed.kind === "requestId") next.requestId = parsed.value;
    if (parsed.kind === "userId") next.userId = parsed.value;
    if (parsed.kind === "email") next.email = parsed.value;
    updateQuery(next);
    safeLog("ops_case_search_submit", { kind: parsed.kind, window: windowValue });
  }, [input, safeLog, searchMode, updateQuery, windowValue]);

  const handleClear = useCallback(() => {
    setInput("");
    setResolvedUserId(null);
    updateQuery({ window: windowValue });
    safeLog("ops_case_search_clear");
  }, [safeLog, updateQuery, windowValue]);

  const refreshAlerts = useCallback(async () => {
    if (!hasQuery) return;
    setAlertsLoading(true);
    const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts", { method: "GET", cache: "no-store" });
    if (res.ok && res.json) {
      const next = coerceOpsAlertsModel(res.json);
      setAlertsData(next);
      setAlertsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${emailParam ?? ""}`;
      if (alertsViewLogged.current !== viewKey) {
        safeLog("ops_case_alerts_view");
        alertsViewLogged.current = viewKey;
      }
    } else {
      setAlertsError({ message: res.error?.message ?? "Unable to load alerts", requestId: res.requestId ?? requestId });
    }
    setAlertsLoading(false);
  }, [effectiveUserId, emailParam, hasQuery, requestId, requestIdParam, safeLog]);

  const refreshIncidents = useCallback(async () => {
    if (!hasQuery) return;
    setIncidentsLoading(true);
    const params = new URLSearchParams();
    params.set("window", windowValue);
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: IncidentRecord[]; count?: number }>(`/api/ops/incidents/preview?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setIncidentsData(res.json.items ?? []);
      setIncidentsCount(res.json.count ?? (res.json.items ?? []).length);
      setIncidentsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (incidentsViewLogged.current !== viewKey) {
        safeLog("ops_case_incidents_view", { window: windowValue });
        incidentsViewLogged.current = viewKey;
      }
    } else {
      setIncidentsError({ message: res.error?.message ?? "Unable to load incidents", requestId: res.requestId ?? requestId });
    }
    setIncidentsLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshAudits = useCallback(async () => {
    if (!hasQuery) return;
    setAuditsLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (requestIdParam) params.set("q", requestIdParam);
    if (effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: AuditItem[] }>(`/api/ops/audits?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setAuditsData((res.json.items ?? []).slice(0, 6));
      setAuditsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (auditsViewLogged.current !== viewKey) {
        safeLog("ops_case_audits_view", { window: windowValue });
        auditsViewLogged.current = viewKey;
      }
    } else {
      setAuditsError({ message: res.error?.message ?? "Unable to load audits", requestId: res.requestId ?? requestId });
    }
    setAuditsLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshWebhooks = useCallback(async () => {
    if (!hasQuery) return;
    setWebhooksLoading(true);
    const params = new URLSearchParams();
    params.set("window", windowValue);
    if (requestIdParam) {
      params.set("q", requestIdParam);
    } else if (effectiveUserId) {
      params.set("q", effectiveUserId);
    }
    params.set("limit", "20");
    const res = await fetchJsonSafe<{ ok: boolean; items?: WebhookFailure[] }>(`/api/ops/webhook-failures?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setWebhooksData((res.json.items ?? []).slice(0, 6));
      setWebhooksError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (webhooksViewLogged.current !== viewKey) {
        safeLog("ops_case_webhooks_view", { window: windowValue });
        webhooksViewLogged.current = viewKey;
      }
    } else {
      setWebhooksError({ message: res.error?.message ?? "Unable to load webhook failures", requestId: res.requestId ?? requestId });
    }
    setWebhooksLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshBilling = useCallback(async () => {
    if (!hasQuery || !effectiveUserId) {
      setBillingData(null);
      setBillingError(null);
      return;
    }
    setBillingLoading(true);
    const res = await fetchJsonSafe<{ ok: boolean } & BillingSnapshot>(`/api/ops/billing/snapshot?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setBillingData(res.json);
      setBillingError(null);
      const viewKey = `${effectiveUserId ?? ""}|${windowValue}`;
      if (billingViewLogged.current !== viewKey) {
        safeLog("ops_case_billing_view", { window: windowValue });
        billingViewLogged.current = viewKey;
      }
    } else {
      setBillingError({ message: res.error?.message ?? "Unable to load billing snapshot", requestId: res.requestId ?? requestId });
    }
    setBillingLoading(false);
  }, [effectiveUserId, hasQuery, requestId, safeLog, windowValue]);

  const runBillingRecheck = useCallback(async () => {
    if (!hasQuery) return;
    setBillingRecheckLoading(true);
    setBillingRecheckHint(null);
    setBillingRecheckError(null);
    safeLog("ops_case_billing_recheck_click", { window: windowValue });
    const res = await fetchJsonSafe<{ ok: boolean }>(`/api/billing/recheck`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setBillingRecheckHint("Recheck completed for the current ops session.");
    } else {
      setBillingRecheckError(res.error?.message ?? "Unable to recheck billing");
    }
    setBillingRecheckLoading(false);
  }, [hasQuery, safeLog, windowValue]);

  const refreshOutcomes = useCallback(async () => {
    if (!hasQuery) return;
    setOutcomesLoading(true);
    const params = new URLSearchParams();
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (!requestIdParam && effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: MaskedOutcome[] }>(`/api/ops/resolution-outcomes/recent?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setOutcomesData(res.json.items ?? []);
      setOutcomesError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (resolutionViewLogged.current !== viewKey) {
        safeLog("ops_case_resolution_view", { window: windowValue });
        resolutionViewLogged.current = viewKey;
      }
    } else {
      setOutcomesError({ message: res.error?.message ?? "Unable to load outcomes", requestId: res.requestId ?? requestId });
    }
    setOutcomesLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshWatch = useCallback(async () => {
    if (!hasQuery) return;
    setWatchLoading(true);
    const params = new URLSearchParams();
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (!requestIdParam && effectiveUserId) params.set("userId", effectiveUserId);
    if (windowValue === "7d") params.set("window", "7d");
    const res = await fetchJsonSafe<{ ok: boolean; records?: WatchRecord[] }>(`/api/ops/watch?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setWatchData(res.json.records ?? []);
      setWatchError(null);
    } else {
      setWatchError({ message: res.error?.message ?? "Unable to load watch items", requestId: res.requestId ?? requestId });
    }
    setWatchLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, windowValue]);

  const handleAttach = useCallback(async () => {
    if (!requestIdParam) return;
    const value = attachValue.trim();
    if (!value) return;
    setAttachLoading(true);
    setAttachError(null);
    setAttachSuccess(null);
    const payload: Record<string, any> = { requestId: requestIdParam };
    if (value.includes("@")) {
      payload.email = value;
    } else {
      payload.userId = value;
    }
    if (attachNote.trim()) {
      payload.note = attachNote.trim();
    }
    const res = await fetchJsonSafe<{ ok: boolean; context?: CaseContext | null }>(`/api/ops/case/context/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.json?.ok) {
      setContextData(res.json.context ?? null);
      setAttachSuccess("Context attached.");
      setAttachValue("");
      setAttachNote("");
      refreshIncidents();
      refreshAudits();
      refreshWebhooks();
      refreshBilling();
      refreshOutcomes();
      refreshWatch();
    } else {
      setAttachError({ message: res.error?.message ?? "Unable to attach context", requestId: res.requestId ?? requestId });
    }
    setAttachLoading(false);
  }, [
    attachNote,
    attachValue,
    refreshAudits,
    refreshBilling,
    refreshIncidents,
    refreshOutcomes,
    refreshWatch,
    refreshWebhooks,
    requestId,
    requestIdParam,
  ]);

  useEffect(() => {
    if (!hasQuery) return;
    refreshAlerts();
    refreshIncidents();
    refreshAudits();
    refreshWebhooks();
    refreshBilling();
    refreshOutcomes();
    refreshWatch();
  }, [hasQuery, refreshAlerts, refreshAudits, refreshBilling, refreshIncidents, refreshOutcomes, refreshWatch, refreshWebhooks]);

  const filteredAlertEvents = useMemo(() => {
    if (!hasQuery) return [];
    const byId = requestIdParam ? alertsData.recentEvents.filter((event: any) => event.id === requestIdParam) : [];
    const byRequest =
      requestIdParam && byId.length === 0
        ? alertsData.recentEvents.filter((event: any) => {
            const signals = event?.signals ?? {};
            const req = signals.requestId ?? signals.request_id ?? null;
            return req && req === requestIdParam;
          })
        : [];
    return (byId.length ? byId : byRequest).slice(0, 6);
  }, [alertsData.recentEvents, hasQuery, requestIdParam]);

  const firingAlerts = useMemo(() => alertsData.alerts.filter((alert: any) => alert.state === "firing"), [alertsData.alerts]);
  const latestHandled = useMemo(() => {
    const handled = alertsData.handled ?? {};
    if (requestIdParam && handled[requestIdParam]) return handled[requestIdParam].at;
    if (filteredAlertEvents.length === 0) return null;
    const handledMatches = filteredAlertEvents
      .map((event: any) => handled[event.id]?.at ?? null)
      .filter(Boolean) as string[];
    if (!handledMatches.length) return null;
    return handledMatches.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [alertsData.handled, filteredAlertEvents, requestIdParam]);

  const incidentGroups = useMemo(() => groupIncidents(incidentsData), [incidentsData]);
  const incidentsEmpty = hasQuery && incidentsData.length === 0 && !incidentsLoading;

  const summarySnippet = useMemo(
    () =>
      buildCaseSnippet({
        requestId: requestIdParam,
        userId: effectiveUserId,
        emailMasked: effectiveEmailMasked,
        contextSources: contextData?.sources ?? null,
        contextLastSeenAt: contextData?.lastSeenAt ?? null,
        window: windowValue,
        latestAlertEventId: filteredAlertEvents[0]?.id ?? null,
        latestWebhookRef: webhooksData[0]?.eventIdHash ?? webhooksData[0]?.groupKeyHash ?? null,
        billingRequestId: billingData?.local?.lastBillingEvent?.requestId ?? null,
      }),
    [
      billingData?.local?.lastBillingEvent?.requestId,
      contextData?.lastSeenAt,
      contextData?.sources,
      effectiveEmailMasked,
      effectiveUserId,
      filteredAlertEvents,
      requestIdParam,
      webhooksData,
      windowValue,
    ]
  );

  const openAlertsLink = buildOpsCaseAlertsLink({
    window: windowValue,
    requestId: requestIdParam,
    eventId: filteredAlertEvents[0]?.id ?? null,
  });
  const openIncidentsLink = buildOpsCaseIncidentsLink({
    window: windowValue,
    requestId: requestIdParam,
    userId: effectiveUserId,
  });
  const openAuditsLink = buildOpsCaseAuditsLink({
    requestId: requestIdParam,
    userId: effectiveUserId,
  });
  const openWebhooksLink = buildOpsCaseWebhooksLink({
    window: windowValue,
    q: requestIdParam ?? effectiveUserId ?? null,
  });
  const openStatusLink = buildOpsCaseStatusLink({ window: windowValue });
  const userLookupHref = emailParam ? `/app/ops?q=${encodeURIComponent(emailParam)}` : "/app/ops";
  const displayedUserId = contextData?.userId ?? effectiveUserId;
  const displayedEmailMasked = contextData?.emailMasked ?? effectiveEmailMasked;
  const contextSourcesLabel = contextData?.sources?.length ? contextData.sources.join(", ") : displayedUserId ? "manual" : "—";
  const showMissingContext = Boolean(requestIdParam && !displayedUserId);

  const handleSnippetCopy = () => {
    safeLog("ops_case_snippet_copy", {
      hasRequestId: Boolean(requestIdParam),
      hasUserId: Boolean(effectiveUserId),
      hasEmail: Boolean(effectiveEmailMasked),
    });
  };

  const handleIncidentsWiden = (removed: string, href: string) => {
    safeLog("ops_case_incidents_widen_click", { removed, window: windowValue });
    window.open(href, "_blank");
  };

  const billingSummary = !effectiveUserId ? "user id required" : billingLoading ? "loading" : billingData?.local?.subscriptionStatus ?? "unavailable";

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Case key</p>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {caseKey.label}: {caseKey.value}
            </p>
            <p className="text-[11px] text-[rgb(var(--muted))]">Paste a requestId, eventId, userId, or email to start.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={windowValue}
              onChange={(e) => {
                const nextWindow = resolveCaseWindow(e.target.value);
                setWindowValue(nextWindow);
                updateQuery({ requestId: requestIdParam, userId: userIdParam, email: emailParam, window: nextWindow });
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Window {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex overflow-hidden rounded-full border border-black/10 bg-white text-xs font-semibold">
              {(["requestId", "userId"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`px-3 py-1 ${searchMode === mode ? "bg-black/80 text-white" : "text-[rgb(var(--ink))]"}`}
                  onClick={() => setSearchMode(mode)}
                >
                  {mode === "requestId" ? "Request" : "User"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[rgb(var(--muted))]">Email is auto-detected.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="req_... / eventId / userId / email"
              className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))]"
            >
              Clear
            </button>
          </div>
          {resolveError ? <p className="text-[11px] text-rose-600">{resolveError}</p> : null}
        </div>
      </div>

      {!hasQuery ? (
        <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          Paste a requestId to begin. Case View will assemble alerts, incidents, audits, and billing signals for quick triage.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-[rgb(var(--muted))]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Alerts: {alertsData.firingCount ?? firingAlerts.length} firing
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Incidents: {incidentsCount}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Webhooks: {webhooksData.length}
              </span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                  Billing: {billingSummary}
                </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Last handled: {latestHandled ? formatShortLocalTime(latestHandled) : "—"}
              </span>
            </div>
            <CopyIconButton text={summarySnippet} label="Copy case snippet" onCopy={handleSnippetCopy} />
          </div>

          {requestIdParam ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-[rgb(var(--muted))]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">User context</p>
                  {displayedUserId ? (
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      User linked: {maskId(displayedUserId)} {displayedEmailMasked ? `· ${displayedEmailMasked}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Missing user context</p>
                  )}
                </div>
                {contextLoading ? <span className="text-[11px] text-[rgb(var(--muted))]">Loading…</span> : null}
              </div>
              {contextError ? (
                <div className="mt-2">
                  <ErrorBanner title="Context unavailable" message={contextError.message} requestId={contextError.requestId ?? undefined} />
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[rgb(var(--muted))]">
                <span>Sources: {contextSourcesLabel}</span>
                {contextData?.lastSeenAt ? <span>Last seen: {formatShortLocalTime(contextData.lastSeenAt)}</span> : null}
                {contextData?.lastSeenPath ? <span>Path: {contextData.lastSeenPath}</span> : null}
              </div>
              {showMissingContext ? (
                <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-2">
                  <p className="text-[11px] text-[rgb(var(--muted))]">
                    Link a user to unlock billing and dossier signals.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={userLookupHref}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                    >
                      Open user lookup
                    </Link>
                  </div>
                </div>
              ) : null}
              {isAdminViewer && showMissingContext ? (
                <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-3">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Attach user context (admin)</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={attachValue}
                      onChange={(e) => setAttachValue(e.target.value)}
                      placeholder="userId or email"
                      className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={attachNote}
                      onChange={(e) => setAttachNote(e.target.value)}
                      placeholder="Optional note"
                      className="min-w-[200px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAttach}
                      disabled={attachLoading || !attachValue.trim()}
                      className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
                    >
                      {attachLoading ? "Attaching…" : "Attach"}
                    </button>
                  </div>
                  {attachError ? (
                    <div className="mt-2">
                      <ErrorBanner title="Attach failed" message={attachError.message} requestId={attachError.requestId ?? undefined} />
                    </div>
                  ) : null}
                  {attachSuccess ? <p className="mt-2 text-[11px] text-emerald-700">{attachSuccess}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Alerts</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent events + firing signals</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openAlertsLink} onClick={() => safeLog("ops_case_alerts_open_click", { window: windowValue })}>
                      Open Alerts
                    </Link>
                  </div>
                </div>
                {alertsError ? <ErrorBanner title="Alerts unavailable" message={alertsError.message} requestId={alertsError.requestId ?? undefined} /> : null}
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--ink))]">Firing now</p>
                    {firingAlerts.length === 0 ? (
                      <p className="text-xs text-[rgb(var(--muted))]">No alerts firing in the last 15m.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs text-[rgb(var(--muted))]">
                        {firingAlerts.slice(0, 4).map((alert: any) => (
                          <li key={alert.key} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-[rgb(var(--ink))]">{alert.summary}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{alert.severity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--ink))]">Related recent events</p>
                    {filteredAlertEvents.length === 0 ? (
                      <p className="text-xs text-[rgb(var(--muted))]">No recent alert events matched this case.</p>
                    ) : (
                      <ul className="mt-1 space-y-2 text-xs text-[rgb(var(--muted))]">
                        {filteredAlertEvents.map((event: any) => (
                          <li key={event.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-[rgb(var(--ink))]">{event.summary}</p>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                                {event.severity ?? "low"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(event.at)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {alertsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Refreshing alerts…</p> : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Incidents</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Windowed incident preview</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openIncidentsLink} onClick={() => safeLog("ops_case_incidents_open_click", { window: windowValue })}>
                      Open Incidents
                    </Link>
                  </div>
                </div>
                {incidentsError ? <ErrorBanner title="Incidents unavailable" message={incidentsError.message} requestId={incidentsError.requestId ?? undefined} /> : null}
                {incidentsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading incidents…</p> : null}
                {!incidentsLoading && incidentsData.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {incidentGroups.slice(0, 4).map((group) => (
                      <div key={group.key} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[rgb(var(--ink))]">{group.message ?? group.code ?? "Incident"}</p>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{group.surface}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {group.count} occurrences · last {formatShortLocalTime(group.lastSeen)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {incidentsEmpty ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-3 text-xs text-[rgb(var(--muted))]">
                    <p className="font-semibold text-[rgb(var(--ink))]">No incidents match this case.</p>
                    <p className="mt-1">Widen the net:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requestIdParam ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                          onClick={() =>
                            handleIncidentsWiden("requestId", buildOpsCaseIncidentsLink({ window: windowValue, userId: effectiveUserId }))
                          }
                        >
                          Remove requestId
                        </button>
                      ) : null}
                      {effectiveUserId ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                          onClick={() =>
                            handleIncidentsWiden("userId", buildOpsCaseIncidentsLink({ window: windowValue, requestId: requestIdParam }))
                          }
                        >
                          Remove userId
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        onClick={() => handleIncidentsWiden("window", buildOpsCaseIncidentsLink({ window: "24h", requestId: requestIdParam, userId: effectiveUserId }))}
                      >
                        Window 24h
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        onClick={() => handleIncidentsWiden("clear", buildOpsCaseIncidentsLink({ window: "24h" }))}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Audits</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent ops audit entries</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openAuditsLink} onClick={() => safeLog("ops_case_audits_open_click", { window: windowValue })}>
                      Open Audits
                    </Link>
                  </div>
                </div>
                {auditsError ? <ErrorBanner title="Audits unavailable" message={auditsError.message} requestId={auditsError.requestId ?? undefined} /> : null}
                {auditsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading audits…</p> : null}
                {!auditsLoading && auditsData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {auditsData.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.action}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.at)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {item.actor?.email ?? "Ops"} · {item.requestId ?? item.ref ?? "No ref"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!auditsLoading && auditsData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No recent audits matched this case.</p>
                ) : null}
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Webhooks</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Failure queue snapshot</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openWebhooksLink} onClick={() => safeLog("ops_case_webhooks_open_click", { window: windowValue })}>
                      Open Webhooks
                    </Link>
                  </div>
                </div>
                {webhooksError ? <ErrorBanner title="Webhook failures unavailable" message={webhooksError.message} requestId={webhooksError.requestId ?? undefined} /> : null}
                {webhooksLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading webhook failures…</p> : null}
                {!webhooksLoading && webhooksData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {webhooksData.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.summary ?? "Webhook failure"}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.at)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {item.code ?? "unknown"} · repeats {item.repeatCount}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!webhooksLoading && webhooksData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No webhook failures matched this case.</p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Billing</p>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">Billing snapshot + recheck</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                      <Link
                        href={`/app/billing${requestIdParam ? `?requestId=${encodeURIComponent(requestIdParam)}` : ""}`}
                        onClick={() => safeLog("ops_case_billing_open_click", { window: windowValue })}
                      >
                        Open Billing Trace
                      </Link>
                      <button type="button" onClick={runBillingRecheck} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        {billingRecheckLoading ? "Rechecking…" : "Recheck"}
                      </button>
                      {effectiveUserId ? (
                        <Link
                          href={`/app/ops/users/${effectiveUserId}#billing-triage`}
                          onClick={() => safeLog("ops_case_billing_open_click", { target: "triage" })}
                        >
                          Ops Billing Triage
                        </Link>
                    ) : null}
                  </div>
                </div>
                {billingError ? <ErrorBanner title="Billing snapshot unavailable" message={billingError.message} requestId={billingError.requestId ?? undefined} /> : null}
                {billingRecheckError ? <ErrorBanner title="Billing recheck failed" message={billingRecheckError} requestId={requestId ?? undefined} /> : null}
                {billingLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading billing snapshot…</p> : null}
                {billingRecheckHint ? <p className="mt-2 text-[11px] text-emerald-700">{billingRecheckHint}</p> : null}
                {!effectiveUserId ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">Billing snapshot requires a userId. Search by user or email to enable.</p>
                ) : null}
                {effectiveUserId && billingData ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    <p>
                      Subscription: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.local?.subscriptionStatus ?? "unknown"}</span>
                    </p>
                    <p>
                      Credits: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.local?.creditsAvailable ?? 0}</span>
                    </p>
                    <p>
                      Webhook health: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.webhookHealth?.status ?? "unknown"}</span>
                    </p>
                    {billingData.delayState?.state && billingData.delayState.state !== "ok" ? (
                      <p className="text-amber-700">Delay: {billingData.delayState.message ?? billingData.delayState.state}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Resolution / Watch</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Outcomes + watch items</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link
                      href={buildOpsCaseResolutionsLink({})}
                      onClick={() => safeLog("ops_case_resolution_open_click", { window: windowValue })}
                    >
                      Open Resolutions
                    </Link>
                    <Link
                      href={openIncidentsLink}
                      onClick={() => safeLog("ops_case_watch_open_click", { window: windowValue })}
                    >
                      Add watch
                    </Link>
                  </div>
                </div>
                {outcomesError ? <ErrorBanner title="Outcomes unavailable" message={outcomesError.message} requestId={outcomesError.requestId ?? undefined} /> : null}
                {watchError ? <ErrorBanner title="Watch list unavailable" message={watchError.message} requestId={watchError.requestId ?? undefined} /> : null}
                {outcomesLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading outcomes…</p> : null}
                {!outcomesLoading && outcomesData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {outcomesData.map((item) => (
                      <li key={item.id ?? item.createdAt} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.code}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">{item.noteMasked ?? "No note"}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {watchLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading watch list…</p> : null}
                {!watchLoading && watchData.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    <p className="font-semibold text-[rgb(var(--ink))]">Active watch items</p>
                    <ul className="space-y-1">
                      {watchData.slice(0, 4).map((item) => (
                        <li key={`${item.requestId}-${item.expiresAt}`}>
                          {item.reasonCode} · expires {formatShortLocalTime(item.expiresAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!watchLoading && watchData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No active watch items for this case.</p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">System status</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Quick health context</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openStatusLink} onClick={() => safeLog("ops_system_status_link_click", { from: "case" })}>
                      Open System Status
                    </Link>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                  Use System Status to confirm RAG signals, webhook health, and rate-limit pressure before escalation.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
