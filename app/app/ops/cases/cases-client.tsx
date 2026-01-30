"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { normaliseId } from "@/lib/ops/normalise-id";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { formatRelativeTime } from "@/lib/tracking-utils";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "monitoring", label: "Monitoring" },
  { value: "waiting", label: "Waiting" },
  { value: "waiting_on_user", label: "Waiting on user" },
  { value: "waiting_on_provider", label: "Waiting on provider" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "p0_p1", label: "P0–P1" },
  { value: "p0", label: "P0" },
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
  { value: "p3", label: "P3" },
];

const ASSIGNED_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const WINDOW_OPTIONS = [
  { value: "15m", label: "15m" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

const SORT_OPTIONS = [
  { value: "lastTouched", label: "Last touched" },
  { value: "createdAt", label: "Created" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "sla", label: "SLA soonest" },
];

type QueueItem = {
  requestId: string;
  status: string;
  priority: string;
  assignedUserId: string | null;
  assignedToMe: boolean;
  lastTouchedAt: string;
  createdAt: string;
  slaDueAt: string | null;
  slaBreached: boolean;
  slaRemainingMs: number | null;
  notesCount: number;
  evidenceCount: number;
  userContext: { userId: string | null; source: string | null; confidence: string | null } | null;
};

type Props = {
  initialQuery: {
    view?: string | null;
    status?: string | null;
    assigned?: string | null;
    priority?: string | null;
    breached?: string | null;
    window?: string | null;
    q?: string | null;
    sort?: string | null;
  };
  viewerRole: "user" | "support" | "admin" | "super_admin";
  viewerId: string;
};

type SavedViewKey = "all" | "my" | "unassigned" | "waiting" | "p0_p1" | "custom";

function maskId(value?: string | null) {
  if (!value) return "";
  if (value.length <= 6) return `${value[0] ?? ""}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function normaliseSelect(value: string | null | undefined, allowed: string[], fallback: string) {
  if (!value) return fallback;
  return allowed.includes(value) ? value : fallback;
}

const SAVED_VIEW_PRESETS: Record<SavedViewKey, { status: string; assigned: string; priority: string; breached: boolean }> = {
  all: { status: "all", assigned: "any", priority: "all", breached: false },
  my: { status: "all", assigned: "me", priority: "all", breached: false },
  unassigned: { status: "all", assigned: "unassigned", priority: "all", breached: false },
  waiting: { status: "waiting", assigned: "any", priority: "all", breached: false },
  p0_p1: { status: "all", assigned: "any", priority: "p0_p1", breached: false },
  custom: { status: "all", assigned: "any", priority: "all", breached: false },
};

const SAVED_VIEWS: Array<{ value: SavedViewKey; label: string }> = [
  { value: "all", label: "All" },
  { value: "my", label: "My queue" },
  { value: "unassigned", label: "Unassigned" },
  { value: "waiting", label: "Waiting" },
  { value: "p0_p1", label: "P0–P1" },
];

function normaliseView(value?: string | null): SavedViewKey {
  if (value === "all" || value === "my" || value === "unassigned" || value === "waiting" || value === "p0_p1") return value;
  if (value === "custom") return "custom";
  return "all";
}

function resolveViewFromFilters({
  status,
  assigned,
  priority,
  breached,
}: {
  status: string;
  assigned: string;
  priority: string;
  breached: boolean;
}): SavedViewKey {
  for (const view of SAVED_VIEWS) {
    const preset = SAVED_VIEW_PRESETS[view.value];
    if (preset.status === status && preset.assigned === assigned && preset.priority === priority && preset.breached === breached) {
      return view.value;
    }
  }
  return "custom";
}

function formatSlaLabel(remainingMs: number | null, breached: boolean) {
  if (remainingMs === null) return "SLA: —";
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let label = "";
  if (days > 0) label = `${days}d`;
  else if (hours > 0) label = `${hours}h`;
  else label = `${minutes}m`;
  return breached ? `SLA breached: ${label}` : `SLA: ${label} left`;
}

export default function CasesClient({ initialQuery, viewerRole, viewerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = viewerRole === "admin" || viewerRole === "super_admin";

  const viewParam = searchParams?.get("view") ?? initialQuery.view ?? "all";
  const statusParam = searchParams?.get("status") ?? initialQuery.status ?? "all";
  const assignedParam = searchParams?.get("assigned") ?? initialQuery.assigned ?? "any";
  const priorityParam = searchParams?.get("priority") ?? initialQuery.priority ?? "all";
  const breachedParam = searchParams?.get("breached") ?? initialQuery.breached ?? "0";
  const windowParam = searchParams?.get("window") ?? initialQuery.window ?? "24h";
  const sortParam = searchParams?.get("sort") ?? initialQuery.sort ?? "lastTouched";
  const queryParam = searchParams?.get("q") ?? initialQuery.q ?? "";

  const viewValue = normaliseView(viewParam);
  const viewPreset = viewValue !== "custom" ? SAVED_VIEW_PRESETS[viewValue] : null;
  const breachedValue = breachedParam === "1" || breachedParam === "true";
  const seedStatus = viewPreset?.status ?? statusParam;
  const seedAssigned = viewPreset?.assigned ?? assignedParam;
  const seedPriority = viewPreset?.priority ?? priorityParam;
  const seedBreached = viewPreset?.breached ?? breachedValue;

  const [view, setView] = useState<SavedViewKey>(viewValue);
  const [status, setStatus] = useState<string>(normaliseSelect(seedStatus, STATUS_OPTIONS.map((o) => o.value), "all"));
  const [assigned, setAssigned] = useState<string>(normaliseSelect(seedAssigned, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
  const [priority, setPriority] = useState<string>(normaliseSelect(seedPriority, PRIORITY_OPTIONS.map((o) => o.value), "all"));
  const [breachedOnly, setBreachedOnly] = useState<boolean>(Boolean(seedBreached));
  const [windowValue, setWindowValue] = useState<string>(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
  const [sort, setSort] = useState<string>(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
  const [query, setQuery] = useState<string>(queryParam ?? "");

  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [actionError, setActionError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const viewLogged = useRef<string | null>(null);
  const pollInFlight = useRef(false);

  const queueHref = useMemo(() => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (assigned && assigned !== "any") params.set("assigned", assigned);
    if (priority && priority !== "all") params.set("priority", priority);
    if (breachedOnly) params.set("breached", "1");
    if (windowValue) params.set("window", windowValue);
    if (sort && sort !== "lastTouched") params.set("sort", sort);
    if (query) params.set("q", normaliseId(query));
    if (view && view !== "all") params.set("view", view);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [assigned, breachedOnly, pathname, priority, query, sort, status, view, windowValue]);

  const queueShareUrl = useMemo(() => {
    if (typeof window === "undefined") return queueHref;
    return `${window.location.origin}${queueHref}`;
  }, [queueHref]);

  useEffect(() => {
    const nextView = normaliseView(viewParam);
    const nextPreset = nextView !== "custom" ? SAVED_VIEW_PRESETS[nextView] : null;
    const nextBreached = nextPreset?.breached ?? (breachedParam === "1" || breachedParam === "true");
    setView(nextView);
    setStatus(normaliseSelect(nextPreset?.status ?? statusParam, STATUS_OPTIONS.map((o) => o.value), "all"));
    setAssigned(normaliseSelect(nextPreset?.assigned ?? assignedParam, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
    setPriority(normaliseSelect(nextPreset?.priority ?? priorityParam, PRIORITY_OPTIONS.map((o) => o.value), "all"));
    setBreachedOnly(Boolean(nextBreached));
    setWindowValue(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
    setSort(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
    setQuery(queryParam ?? "");
  }, [assignedParam, breachedParam, priorityParam, queryParam, sortParam, statusParam, viewParam, windowParam]);

  const updateQuery = useCallback(
    (next: {
      status?: string;
      assigned?: string;
      priority?: string;
      breached?: boolean;
      window?: string;
      q?: string;
      sort?: string;
      view?: SavedViewKey;
    }) => {
      const params = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextAssigned = next.assigned ?? assigned;
      const nextPriority = next.priority ?? priority;
      const nextBreached = next.breached ?? breachedOnly;
      const nextWindow = next.window ?? windowValue;
      const nextSort = next.sort ?? sort;
      const nextQ = next.q ?? query;
      const nextView = next.view ?? view;
      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      if (nextAssigned && nextAssigned !== "any") params.set("assigned", nextAssigned);
      if (nextPriority && nextPriority !== "all") params.set("priority", nextPriority);
      if (nextBreached) params.set("breached", "1");
      if (nextWindow) params.set("window", nextWindow);
      if (nextSort && nextSort !== "lastTouched") params.set("sort", nextSort);
      if (nextQ) params.set("q", normaliseId(nextQ));
      if (nextView && nextView !== "all") params.set("view", nextView);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [assigned, breachedOnly, pathname, priority, query, router, sort, status, view, windowValue]
  );

  const fetchCases = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean; silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      if (!opts?.append) setError(null);
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (assigned && assigned !== "any") params.set("assigned", assigned);
      if (priority && priority !== "all") params.set("priority", priority);
      if (breachedOnly) params.set("breached", "1");
      if (windowValue) params.set("window", windowValue);
      if (sort && sort !== "lastTouched") params.set("sort", sort);
      if (query) params.set("q", normaliseId(query));
      if (opts?.cursor) params.set("cursor", opts.cursor);
      params.set("limit", "50");

      const res = await fetchJsonSafe<{ ok: boolean; items?: QueueItem[]; nextCursor?: string | null }>(
        `/api/ops/cases?${params.toString()}`,
        { method: "GET", cache: "no-store" }
      );
      if (res.ok && res.json?.ok) {
        const nextItems = res.json.items ?? [];
        setItems((prev) => (opts?.append ? [...prev, ...nextItems] : nextItems));
        setNextCursor(res.json.nextCursor ?? null);
        setError(null);
        setLastUpdatedAt(new Date().toISOString());
        setStale(false);
      } else {
        const message = res.error?.message ?? "Unable to load cases";
        setError({ message, requestId: res.requestId ?? undefined });
        logMonetisationClientEvent("ops_cases_load_error", null, "ops", { code: res.error?.code ?? "unknown" });
        setStale(true);
      }
      if (!opts?.silent) setLoading(false);
    },
    [assigned, breachedOnly, priority, query, sort, status, windowValue]
  );

  useEffect(() => {
    const viewKey = [view, status, assigned, priority, breachedOnly ? "1" : "0", windowValue, sort, query].join("|");
    if (viewLogged.current !== viewKey) {
      logMonetisationClientEvent("ops_cases_view", null, "ops", { window: windowValue, hasQuery: Boolean(query) });
      viewLogged.current = viewKey;
    }
    fetchCases({ append: false });
  }, [assigned, breachedOnly, fetchCases, priority, query, sort, status, view, windowValue]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor) return;
    fetchCases({ cursor: nextCursor, append: true });
  }, [fetchCases, nextCursor]);

  useEffect(() => {
    let active = true;
    const runPoll = () => {
      if (!active || document.visibilityState !== "visible") {
        if (document.visibilityState !== "visible") setStale(true);
        return;
      }
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      fetchCases({ append: false, silent: true })
        .catch(() => undefined)
        .finally(() => {
          pollInFlight.current = false;
        });
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        setStale(true);
        return;
      }
      runPoll();
    };
    const interval = window.setInterval(runPoll, 20000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCases]);

  const handleClaim = useCallback(
    async (requestId: string) => {
      setActionError(null);
      const res = await fetchJsonSafe<{ ok: boolean; workflow?: any }>("/api/ops/cases/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok && res.json?.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.requestId === requestId
              ? {
                  ...item,
                  status: res.json?.workflow?.status ?? item.status,
                  priority: res.json?.workflow?.priority ?? item.priority,
                  assignedUserId: res.json?.workflow?.assignedToUserId ?? viewerId,
                  assignedToMe: true,
                  lastTouchedAt: res.json?.workflow?.lastTouchedAt ?? item.lastTouchedAt,
                }
              : item
          )
        );
        logMonetisationClientEvent("ops_cases_claim", null, "ops", { status: res.json?.workflow?.status ?? null });
      } else {
        setActionError({ message: res.error?.message ?? "Unable to claim case", requestId: res.requestId ?? undefined });
      }
    },
    [viewerId]
  );

  const handleRelease = useCallback(async (requestId: string) => {
    setActionError(null);
    const res = await fetchJsonSafe<{ ok: boolean; workflow?: any }>("/api/ops/cases/release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok && res.json?.ok) {
      setItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId
            ? {
                ...item,
                status: res.json?.workflow?.status ?? item.status,
                priority: res.json?.workflow?.priority ?? item.priority,
                assignedUserId: null,
                assignedToMe: false,
                lastTouchedAt: res.json?.workflow?.lastTouchedAt ?? item.lastTouchedAt,
              }
            : item
        )
      );
      logMonetisationClientEvent("ops_cases_release", null, "ops", { status: res.json?.workflow?.status ?? null });
    } else {
      setActionError({ message: res.error?.message ?? "Unable to release case", requestId: res.requestId ?? undefined });
    }
  }, []);

  const handleStatusChange = useCallback(async (requestId: string, nextStatus: string) => {
    setActionError(null);
    const res = await fetchJsonSafe<{ ok: boolean; workflow?: any }>("/api/ops/cases/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, status: nextStatus }),
    });
    if (res.ok && res.json?.ok) {
      setItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId
            ? {
                ...item,
                status: res.json?.workflow?.status ?? item.status,
                priority: res.json?.workflow?.priority ?? item.priority,
                assignedUserId: res.json?.workflow?.assignedToUserId ?? item.assignedUserId,
                assignedToMe: (res.json?.workflow?.assignedToUserId ?? item.assignedUserId) === viewerId,
                lastTouchedAt: res.json?.workflow?.lastTouchedAt ?? item.lastTouchedAt,
              }
            : item
        )
      );
      logMonetisationClientEvent("ops_cases_status_change", null, "ops", { status: nextStatus });
    } else {
      setActionError({ message: res.error?.message ?? "Unable to update status", requestId: res.requestId ?? undefined });
    }
  }, [viewerId]);

  const handlePriorityChange = useCallback(async (requestId: string, nextPriority: string) => {
    setActionError(null);
    const res = await fetchJsonSafe<{ ok: boolean; workflow?: any }>("/api/ops/cases/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, priority: nextPriority }),
    });
    if (res.ok && res.json?.ok) {
      setItems((prev) =>
        prev.map((item) =>
          item.requestId === requestId
            ? {
                ...item,
                status: res.json?.workflow?.status ?? item.status,
                priority: res.json?.workflow?.priority ?? item.priority,
                assignedUserId: res.json?.workflow?.assignedToUserId ?? item.assignedUserId,
                assignedToMe: (res.json?.workflow?.assignedToUserId ?? item.assignedUserId) === viewerId,
                lastTouchedAt: res.json?.workflow?.lastTouchedAt ?? item.lastTouchedAt,
              }
            : item
        )
      );
      logMonetisationClientEvent("ops_cases_priority_change", null, "ops", { priority: nextPriority });
    } else {
      setActionError({ message: res.error?.message ?? "Unable to update priority", requestId: res.requestId ?? undefined });
    }
  }, [viewerId]);

  const handleFilterChange = useCallback(
    (next: { status?: string; assigned?: string; priority?: string; breached?: boolean; window?: string }) => {
      const nextStatus = next.status ?? status;
      const nextAssigned = next.assigned ?? assigned;
      const nextPriority = next.priority ?? priority;
      const nextBreached = next.breached ?? breachedOnly;
      const nextView = query ? "custom" : resolveViewFromFilters({
        status: nextStatus,
        assigned: nextAssigned,
        priority: nextPriority,
        breached: nextBreached,
      });
      setView(nextView);
      updateQuery({ ...next, view: nextView });
      logMonetisationClientEvent("ops_cases_filter_change", null, "ops", {
        status: nextStatus,
        assigned: nextAssigned,
        priority: nextPriority,
        window: next.window ?? windowValue,
        hasQuery: Boolean(query),
      });
    },
    [assigned, breachedOnly, priority, query, status, updateQuery, windowValue]
  );

  const handleSortChange = useCallback(
    (nextSort: string) => {
      setSort(nextSort);
      updateQuery({ sort: nextSort });
      logMonetisationClientEvent("ops_cases_sort_changed", null, "ops", { sort: nextSort });
    },
    [updateQuery]
  );

  const handleViewSelect = useCallback(
    (nextView: SavedViewKey) => {
      const preset = SAVED_VIEW_PRESETS[nextView];
      setView(nextView);
      setStatus(preset.status);
      setAssigned(preset.assigned);
      setPriority(preset.priority);
      setBreachedOnly(preset.breached);
      setQuery("");
      updateQuery({
        status: preset.status,
        assigned: preset.assigned,
        priority: preset.priority,
        breached: preset.breached,
        q: "",
        view: nextView,
      });
      logMonetisationClientEvent("ops_cases_view_selected", null, "ops", { view: nextView });
    },
    [updateQuery]
  );

  const canEditItem = useCallback(
    (item: QueueItem) => isAdmin || item.assignedToMe || !item.assignedUserId,
    [isAdmin]
  );

  const emptyState = !loading && items.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Cases</h1>
        <p className="text-xs text-[rgb(var(--muted))]">RequestId-first ops inbox.</p>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
            {SAVED_VIEWS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleViewSelect(item.value)}
                className={`rounded-full px-3 py-1 ${
                  view === item.value
                    ? "bg-[rgb(var(--ink))] text-white"
                    : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                }`}
              >
                {item.label}
              </button>
            ))}
            {view === "custom" ? (
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-[rgb(var(--muted))]">
                Custom
              </span>
            ) : null}
            <CopyIconButton text={queueShareUrl} label="Copy view link" />
          </div>
          <div className="text-[11px] text-[rgb(var(--muted))]">
            <span>Last updated: {lastUpdatedAt ? formatShortLocalTime(lastUpdatedAt) : "—"}</span>
            {stale ? <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Data stale</span> : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-[rgb(var(--ink))]">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                handleFilterChange({ status: event.target.value });
              }}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--ink))]">
            Assigned
            <select
              value={assigned}
              onChange={(event) => {
                setAssigned(event.target.value);
                handleFilterChange({ assigned: event.target.value });
              }}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {ASSIGNED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--ink))]">
            Priority
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                handleFilterChange({ priority: event.target.value });
              }}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--ink))]">
            Window
            <select
              value={windowValue}
              onChange={(event) => {
                setWindowValue(event.target.value);
                handleFilterChange({ window: event.target.value });
              }}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--ink))]">
            Sort
            <select
              value={sort}
              onChange={(event) => handleSortChange(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-5 flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
            <input
              type="checkbox"
              checked={breachedOnly}
              onChange={(event) => {
                setBreachedOnly(event.target.checked);
                handleFilterChange({ breached: event.target.checked });
                logMonetisationClientEvent("ops_cases_sla_filter_used", null, "ops", { breachedOnly: event.target.checked });
              }}
              className="h-4 w-4 rounded border-black/20"
            />
            Show breached only
          </label>
          <label className="flex-1 text-xs font-semibold text-[rgb(var(--ink))]">
            Search
            <div className="mt-1 flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="requestId / userId / eventId"
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const nextView = query ? "custom" : resolveViewFromFilters({ status, assigned, priority, breached: breachedOnly });
                  setView(nextView);
                  updateQuery({ q: query, view: nextView });
                  logMonetisationClientEvent("ops_cases_filter_change", null, "ops", { hasQuery: Boolean(query) });
                }}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Apply
              </button>
            </div>
          </label>
        </div>
      </div>

      {error ? <ErrorBanner title="Cases unavailable" message={error.message} requestId={error.requestId ?? undefined} /> : null}
      {actionError ? <ErrorBanner title="Case update failed" message={actionError.message} requestId={actionError.requestId ?? undefined} /> : null}

      {emptyState ? (
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          <p className="font-semibold text-[rgb(var(--ink))]">No cases match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setAssigned("any");
              setPriority("all");
              setBreachedOnly(false);
              setWindowValue("24h");
              setSort("lastTouched");
              setQuery("");
              setView("all");
              updateQuery({
                status: "all",
                assigned: "any",
                priority: "all",
                breached: false,
                window: "24h",
                q: "",
                sort: "lastTouched",
                view: "all",
              });
            }}
            className="mt-3 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const canEdit = canEditItem(item);
            const slaLabel = formatSlaLabel(item.slaRemainingMs, item.slaBreached);
            return (
              <div
                key={item.requestId}
                className={`rounded-3xl border p-4 ${
                  item.slaBreached ? "border-amber-200 bg-amber-50/70" : "border-black/10 bg-white/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.requestId}</p>
                      <CopyIconButton
                        text={item.requestId}
                        label="Copy requestId"
                        onCopy={() => logMonetisationClientEvent("ops_cases_copy_request_id", null, "ops", { status: item.status })}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
                      <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))]">
                        {item.status.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[rgb(var(--ink))]">
                        {item.priority.toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          item.slaBreached ? "border-amber-200 bg-amber-100 text-amber-900" : "border-black/10 bg-white text-[rgb(var(--ink))]"
                        }`}
                      >
                        {slaLabel}
                      </span>
                      <span>Last touched {formatRelativeTime(item.lastTouchedAt)}</span>
                      <span>· {formatShortLocalTime(item.lastTouchedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href={`/app/ops/case?requestId=${encodeURIComponent(item.requestId)}&returnTo=${encodeURIComponent(queueHref)}`}
                      onClick={() => logMonetisationClientEvent("ops_cases_open_case_clicked", null, "ops", { status: item.status })}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                    >
                      Open case
                    </Link>
                    {!item.assignedUserId ? (
                      <button
                        type="button"
                        onClick={() => handleClaim(item.requestId)}
                        className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Claim
                      </button>
                    ) : item.assignedToMe ? (
                      <button
                        type="button"
                        onClick={() => handleRelease(item.requestId)}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                      >
                        Release
                      </button>
                    ) : (
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-[rgb(var(--muted))]">Claimed</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="text-xs text-[rgb(var(--muted))]">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Assigned</p>
                    {item.assignedUserId ? (
                      <p className="mt-1 text-sm font-semibold text-[rgb(var(--ink))]">
                        {item.assignedToMe ? "Me" : maskId(item.assignedUserId)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[rgb(var(--muted))]">Unassigned</p>
                    )}
                  </div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">User context</p>
                    {item.userContext?.userId ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[rgb(var(--ink))]">{maskId(item.userContext.userId)}</span>
                        <CopyIconButton
                          text={item.userContext.userId}
                          label="Copy userId"
                          onCopy={() => logMonetisationClientEvent("ops_cases_copy_user_id", null, "ops", { status: item.status })}
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-[rgb(var(--muted))]">Not linked</p>
                    )}
                    {item.userContext?.source ? (
                      <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">
                        {item.userContext.source} · {item.userContext.confidence ?? "unknown"}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Notes / Evidence</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        Notes {item.notesCount}
                      </span>
                      <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        Evidence {item.evidenceCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[rgb(var(--muted))]">Status</span>
                    <select
                      value={item.status}
                      onChange={(event) => handleStatusChange(item.requestId, event.target.value)}
                      disabled={!canEdit}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed disabled:text-[rgb(var(--muted))]"
                    >
                      {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                        <option key={option.value} value={option.value} disabled={!isAdmin && option.value === "closed"}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[rgb(var(--muted))]">Priority</span>
                    <select
                      value={item.priority}
                      onChange={(event) => handlePriorityChange(item.requestId, event.target.value)}
                      disabled={!canEdit}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed disabled:text-[rgb(var(--muted))]"
                    >
                      {PRIORITY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          onClick={handleLoadMore}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {loading ? <p className="text-[11px] text-[rgb(var(--muted))]">Loading cases…</p> : null}
    </div>
  );
}
