"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  { value: "waiting_on_user", label: "Waiting on user" },
  { value: "waiting_on_provider", label: "Waiting on provider" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All" },
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
];

type QueueItem = {
  requestId: string;
  status: string;
  priority: string;
  assignedUserId: string | null;
  assignedToMe: boolean;
  lastTouchedAt: string;
  createdAt: string;
  notesCount: number;
  evidenceCount: number;
  userContext: { userId: string | null; source: string | null; confidence: string | null } | null;
};

type Props = {
  initialQuery: {
    status?: string | null;
    assigned?: string | null;
    priority?: string | null;
    window?: string | null;
    q?: string | null;
    sort?: string | null;
  };
  viewerRole: "user" | "support" | "admin" | "super_admin";
  viewerId: string;
};

function maskId(value?: string | null) {
  if (!value) return "";
  if (value.length <= 6) return `${value[0] ?? ""}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function normaliseSelect(value: string | null | undefined, allowed: string[], fallback: string) {
  if (!value) return fallback;
  return allowed.includes(value) ? value : fallback;
}

export default function CasesClient({ initialQuery, viewerRole, viewerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = viewerRole === "admin" || viewerRole === "super_admin";

  const statusParam = searchParams?.get("status") ?? initialQuery.status ?? "all";
  const assignedParam = searchParams?.get("assigned") ?? initialQuery.assigned ?? "any";
  const priorityParam = searchParams?.get("priority") ?? initialQuery.priority ?? "all";
  const windowParam = searchParams?.get("window") ?? initialQuery.window ?? "24h";
  const sortParam = searchParams?.get("sort") ?? initialQuery.sort ?? "lastTouched";
  const queryParam = searchParams?.get("q") ?? initialQuery.q ?? "";

  const [status, setStatus] = useState<string>(normaliseSelect(statusParam, STATUS_OPTIONS.map((o) => o.value), "all"));
  const [assigned, setAssigned] = useState<string>(normaliseSelect(assignedParam, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
  const [priority, setPriority] = useState<string>(normaliseSelect(priorityParam, PRIORITY_OPTIONS.map((o) => o.value), "all"));
  const [windowValue, setWindowValue] = useState<string>(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
  const [sort, setSort] = useState<string>(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
  const [query, setQuery] = useState<string>(queryParam ?? "");

  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [actionError, setActionError] = useState<{ message: string; requestId?: string | null } | null>(null);

  const viewLogged = useRef<string | null>(null);

  useEffect(() => {
    setStatus(normaliseSelect(statusParam, STATUS_OPTIONS.map((o) => o.value), "all"));
    setAssigned(normaliseSelect(assignedParam, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
    setPriority(normaliseSelect(priorityParam, PRIORITY_OPTIONS.map((o) => o.value), "all"));
    setWindowValue(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
    setSort(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
    setQuery(queryParam ?? "");
  }, [assignedParam, priorityParam, queryParam, sortParam, statusParam, windowParam]);

  const updateQuery = useCallback(
    (next: { status?: string; assigned?: string; priority?: string; window?: string; q?: string; sort?: string }) => {
      const params = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextAssigned = next.assigned ?? assigned;
      const nextPriority = next.priority ?? priority;
      const nextWindow = next.window ?? windowValue;
      const nextSort = next.sort ?? sort;
      const nextQ = next.q ?? query;
      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      if (nextAssigned && nextAssigned !== "any") params.set("assigned", nextAssigned);
      if (nextPriority && nextPriority !== "all") params.set("priority", nextPriority);
      if (nextWindow) params.set("window", nextWindow);
      if (nextSort && nextSort !== "lastTouched") params.set("sort", nextSort);
      if (nextQ) params.set("q", normaliseId(nextQ));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [assigned, pathname, priority, query, router, sort, status, windowValue]
  );

  const fetchCases = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean }) => {
      setLoading(true);
      if (!opts?.append) setError(null);
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (assigned && assigned !== "any") params.set("assigned", assigned);
      if (priority && priority !== "all") params.set("priority", priority);
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
      } else {
        const message = res.error?.message ?? "Unable to load cases";
        setError({ message, requestId: res.requestId ?? undefined });
        logMonetisationClientEvent("ops_cases_load_error", null, "ops", { code: res.error?.code ?? "unknown" });
      }
      setLoading(false);
    },
    [assigned, priority, query, sort, status, windowValue]
  );

  useEffect(() => {
    const viewKey = [status, assigned, priority, windowValue, sort, query].join("|");
    if (viewLogged.current !== viewKey) {
      logMonetisationClientEvent("ops_cases_view", null, "ops", { window: windowValue, hasQuery: Boolean(query) });
      viewLogged.current = viewKey;
    }
    fetchCases({ append: false });
  }, [assigned, fetchCases, priority, query, sort, status, windowValue]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor) return;
    fetchCases({ cursor: nextCursor, append: true });
  }, [fetchCases, nextCursor]);

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
    (next: { status?: string; assigned?: string; priority?: string; window?: string }) => {
      updateQuery(next);
      logMonetisationClientEvent("ops_cases_filter_change", null, "ops", {
        status: next.status ?? status,
        assigned: next.assigned ?? assigned,
        priority: next.priority ?? priority,
        window: next.window ?? windowValue,
        hasQuery: Boolean(query),
      });
    },
    [assigned, priority, query, status, updateQuery, windowValue]
  );

  const handleSortChange = useCallback(
    (nextSort: string) => {
      setSort(nextSort);
      updateQuery({ sort: nextSort });
      logMonetisationClientEvent("ops_cases_sort_change", null, "ops", { sort: nextSort });
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
        <div className="flex flex-wrap items-end gap-3">
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
                  updateQuery({ q: query });
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
            onClick={() => updateQuery({ status: "all", assigned: "any", priority: "all", window: "24h", q: "", sort: "lastTouched" })}
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
            return (
              <div key={item.requestId} className="rounded-3xl border border-black/10 bg-white/80 p-4">
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
                      <span>Last touched {formatRelativeTime(item.lastTouchedAt)}</span>
                      <span>· {formatShortLocalTime(item.lastTouchedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href={`/app/ops/case?requestId=${encodeURIComponent(item.requestId)}`}
                      onClick={() => logMonetisationClientEvent("ops_cases_open_case", null, "ops", { status: item.status })}
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
