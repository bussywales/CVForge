"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { normaliseId } from "@/lib/ops/normalise-id";
import { formatCaseSlaLabel } from "@/lib/ops/ops-case-sla";
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
  { value: "p0_p1", label: "P0-P1" },
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

const SLA_POLICY_LINES = [
  "P0: 15m",
  "P1: 60m",
  "P2: 4h",
  "P3: 24h",
  "Anchor: created_at",
  "Paused while waiting_on_user or waiting_on_provider.",
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

type PresetViewKey = "all" | "my" | "unassigned" | "waiting" | "p0_p1";
type ViewKey = PresetViewKey | "custom" | string;

type CaseViewFilters = {
  status: string;
  assigned: string;
  priority: string;
  breached: boolean;
  window: string;
  sort: string;
  q: string;
};

type SavedView = {
  id: string;
  name: string;
  isDefault: boolean;
  view: CaseViewFilters;
  createdAt?: string | null;
  updatedAt?: string | null;
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

const PRESET_VIEWS: Array<{ value: PresetViewKey; label: string }> = [
  { value: "all", label: "All" },
  { value: "my", label: "My queue" },
  { value: "unassigned", label: "Unassigned" },
  { value: "waiting", label: "Waiting" },
  { value: "p0_p1", label: "P0-P1" },
];

const FILTER_CHIPS: PresetViewKey[] = ["my", "unassigned", "waiting", "p0_p1"];

const PRESET_VIEW_PRESETS: Record<PresetViewKey, { status: string; assigned: string; priority: string; breached: boolean }> = {
  all: { status: "all", assigned: "any", priority: "all", breached: false },
  my: { status: "all", assigned: "me", priority: "all", breached: false },
  unassigned: { status: "all", assigned: "unassigned", priority: "all", breached: false },
  waiting: { status: "waiting", assigned: "any", priority: "all", breached: false },
  p0_p1: { status: "all", assigned: "any", priority: "p0_p1", breached: false },
};

function isPresetViewKey(value: string): value is PresetViewKey {
  return PRESET_VIEWS.some((view) => view.value === value);
}

function normaliseViewKey(value?: string | null): ViewKey {
  if (!value) return "all";
  if (isPresetViewKey(value) || value === "custom") return value;
  return value;
}

function resolvePresetFromFilters({
  status,
  assigned,
  priority,
  breached,
}: {
  status: string;
  assigned: string;
  priority: string;
  breached: boolean;
}): PresetViewKey | "custom" {
  for (const view of PRESET_VIEWS) {
    const preset = PRESET_VIEW_PRESETS[view.value];
    if (preset.status === status && preset.assigned === assigned && preset.priority === priority && preset.breached === breached) {
      return view.value;
    }
  }
  return "custom";
}

function buildViewFilters(input: Partial<CaseViewFilters>): CaseViewFilters {
  return {
    status: input.status ?? "all",
    assigned: input.assigned ?? "any",
    priority: input.priority ?? "all",
    breached: Boolean(input.breached),
    window: input.window ?? "24h",
    sort: input.sort ?? "lastTouched",
    q: normaliseId(input.q ?? ""),
  };
}

function normaliseViewFilters(input: Partial<CaseViewFilters> | null | undefined): CaseViewFilters {
  return {
    status: normaliseSelect(input?.status ?? "all", STATUS_OPTIONS.map((o) => o.value), "all"),
    assigned: normaliseSelect(input?.assigned ?? "any", ASSIGNED_OPTIONS.map((o) => o.value), "any"),
    priority: normaliseSelect(input?.priority ?? "all", PRIORITY_OPTIONS.map((o) => o.value), "all"),
    breached: Boolean(input?.breached),
    window: normaliseSelect(input?.window ?? "24h", WINDOW_OPTIONS.map((o) => o.value), "24h"),
    sort: normaliseSelect(input?.sort ?? "lastTouched", SORT_OPTIONS.map((o) => o.value), "lastTouched"),
    q: normaliseId(input?.q ?? ""),
  };
}

function viewFiltersEqual(a: CaseViewFilters, b: CaseViewFilters) {
  return (
    a.status === b.status &&
    a.assigned === b.assigned &&
    a.priority === b.priority &&
    a.breached === b.breached &&
    a.window === b.window &&
    a.sort === b.sort &&
    normaliseId(a.q) === normaliseId(b.q)
  );
}

function isWaitingStatus(status: string) {
  return status === "waiting_on_user" || status === "waiting_on_provider";
}

function buildQueueSignature(items: QueueItem[]) {
  return items
    .slice(0, 20)
    .map((item) => `${item.requestId}:${item.lastTouchedAt}`)
    .join("|");
}

export default function CasesClient({ initialQuery, viewerRole, viewerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = viewerRole === "admin" || viewerRole === "super_admin";

  const viewParamRaw = searchParams?.get("view") ?? initialQuery.view ?? null;
  const statusParam = searchParams?.get("status") ?? initialQuery.status ?? "all";
  const assignedParam = searchParams?.get("assigned") ?? initialQuery.assigned ?? "any";
  const priorityParam = searchParams?.get("priority") ?? initialQuery.priority ?? "all";
  const breachedParam = searchParams?.get("breached") ?? initialQuery.breached ?? "0";
  const windowParam = searchParams?.get("window") ?? initialQuery.window ?? "24h";
  const sortParam = searchParams?.get("sort") ?? initialQuery.sort ?? "lastTouched";
  const queryParam = searchParams?.get("q") ?? initialQuery.q ?? "";

  const viewValue = normaliseViewKey(viewParamRaw);
  const hasExplicitView = Boolean(searchParams?.get("view") ?? initialQuery.view);
  const breachedValue = breachedParam === "1" || breachedParam === "true";

  const [view, setView] = useState<ViewKey>(viewValue);
  const [status, setStatus] = useState<string>(normaliseSelect(statusParam, STATUS_OPTIONS.map((o) => o.value), "all"));
  const [assigned, setAssigned] = useState<string>(normaliseSelect(assignedParam, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
  const [priority, setPriority] = useState<string>(normaliseSelect(priorityParam, PRIORITY_OPTIONS.map((o) => o.value), "all"));
  const [breachedOnly, setBreachedOnly] = useState<boolean>(Boolean(breachedValue));
  const [windowValue, setWindowValue] = useState<string>(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
  const [sort, setSort] = useState<string>(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
  const [query, setQuery] = useState<string>(queryParam ?? "");

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewsError, setViewsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [draftViewId, setDraftViewId] = useState<string | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const [items, setItems] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [actionError, setActionError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [polling, setPolling] = useState(false);
  const [slaInfoOpen, setSlaInfoOpen] = useState(false);

  const viewLogged = useRef<string | null>(null);
  const pollInFlight = useRef(false);
  const pollDelayRef = useRef(20000);
  const pollTimerRef = useRef<number | null>(null);
  const pollRunRef = useRef<(() => void) | null>(null);
  const lastPollLogRef = useRef(0);
  const lastSignatureRef = useRef<string>("");
  const defaultApplied = useRef(false);

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

  const currentFilters = useMemo(
    () =>
      buildViewFilters({
        status,
        assigned,
        priority,
        breached: breachedOnly,
        window: windowValue,
        sort,
        q: query,
      }),
    [assigned, breachedOnly, priority, query, sort, status, windowValue]
  );

  const activeSavedViewId = useMemo(() => {
    if (view !== "custom" && !isPresetViewKey(view)) return view;
    return draftViewId;
  }, [draftViewId, view]);

  const activeSavedView = useMemo(
    () => (activeSavedViewId ? savedViews.find((saved) => saved.id === activeSavedViewId) ?? null : null),
    [activeSavedViewId, savedViews]
  );

  const activeSavedFilters = useMemo(
    () => (activeSavedView ? normaliseViewFilters(activeSavedView.view) : null),
    [activeSavedView]
  );

  const hasViewChanges = Boolean(activeSavedFilters && !viewFiltersEqual(currentFilters, activeSavedFilters));

  const activePreset = useMemo(
    () => resolvePresetFromFilters({ status, assigned, priority, breached: breachedOnly }),
    [assigned, breachedOnly, priority, status]
  );

  useEffect(() => {
    const nextView = normaliseViewKey(viewParamRaw);
    setView(nextView);
    setStatus(normaliseSelect(statusParam, STATUS_OPTIONS.map((o) => o.value), "all"));
    setAssigned(normaliseSelect(assignedParam, ASSIGNED_OPTIONS.map((o) => o.value), "any"));
    setPriority(normaliseSelect(priorityParam, PRIORITY_OPTIONS.map((o) => o.value), "all"));
    setBreachedOnly(Boolean(breachedValue));
    setWindowValue(normaliseSelect(windowParam, WINDOW_OPTIONS.map((o) => o.value), "24h"));
    setSort(normaliseSelect(sortParam, SORT_OPTIONS.map((o) => o.value), "lastTouched"));
    setQuery(queryParam ?? "");
  }, [
    assignedParam,
    breachedValue,
    priorityParam,
    queryParam,
    sortParam,
    statusParam,
    viewParamRaw,
    windowParam,
  ]);

  const updateQuery = useCallback(
    (next: {
      status?: string;
      assigned?: string;
      priority?: string;
      breached?: boolean;
      window?: string;
      q?: string;
      sort?: string;
      view?: ViewKey;
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

  const applyFilters = useCallback((filters: CaseViewFilters) => {
    setStatus(filters.status);
    setAssigned(filters.assigned);
    setPriority(filters.priority);
    setBreachedOnly(filters.breached);
    setWindowValue(filters.window);
    setSort(filters.sort);
    setQuery(filters.q);
  }, []);

  const resetPolling = useCallback(() => {
    pollDelayRef.current = 20000;
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (document.visibilityState === "visible" && pollRunRef.current) {
      pollTimerRef.current = window.setTimeout(pollRunRef.current, pollDelayRef.current);
    }
  }, []);

  const loadViews = useCallback(async () => {
    setViewsLoading(true);
    const res = await fetchJsonSafe<{ ok: boolean; views?: any[] }>(`/api/ops/cases/views`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      const nextViews = (res.json.views ?? []).map((view) => ({
        id: String(view.id ?? ""),
        name: String(view.name ?? "Saved view"),
        isDefault: Boolean(view.isDefault),
        view: normaliseViewFilters(view.view ?? {}),
        createdAt: view.createdAt ?? null,
        updatedAt: view.updatedAt ?? null,
      })) as SavedView[];
      setSavedViews(nextViews);
      setViewsError(null);
      setRenameDrafts((prev) => {
        const next: Record<string, string> = { ...prev };
        nextViews.forEach((saved) => {
          if (!next[saved.id]) next[saved.id] = saved.name;
        });
        return next;
      });
    } else {
      setViewsError({ message: res.error?.message ?? "Unable to load saved views", requestId: res.requestId ?? undefined });
    }
    setViewsLoading(false);
  }, []);

  useEffect(() => {
    loadViews().catch(() => undefined);
  }, [loadViews]);

  useEffect(() => {
    if (hasExplicitView || defaultApplied.current) return;
    const defaultView = savedViews.find((saved) => saved.isDefault);
    if (!defaultView) return;
    defaultApplied.current = true;
    setView(defaultView.id);
    setDraftViewId(defaultView.id);
    applyFilters(normaliseViewFilters(defaultView.view));
    updateQuery({ ...normaliseViewFilters(defaultView.view), view: defaultView.id });
    logMonetisationClientEvent("ops_cases_view_selected", null, "ops", { view: "default" });
  }, [applyFilters, hasExplicitView, savedViews, updateQuery]);

  useEffect(() => {
    if (!isPresetViewKey(view)) return;
    const preset = PRESET_VIEW_PRESETS[view];
    applyFilters(
      buildViewFilters({
        ...preset,
        window: windowValue,
        sort,
        q: "",
      })
    );
    setDraftViewId(null);
  }, [applyFilters, sort, view, windowValue]);

  useEffect(() => {
    if (view === "custom" || isPresetViewKey(view)) return;
    const saved = savedViews.find((item) => item.id === view);
    if (!saved) return;
    applyFilters(normaliseViewFilters(saved.view));
    setDraftViewId(saved.id);
  }, [applyFilters, savedViews, view]);

  useEffect(() => {
    if (view !== "custom" && !isPresetViewKey(view)) {
      setDraftViewId(view);
      return;
    }
    if (isPresetViewKey(view)) {
      setDraftViewId(null);
    }
  }, [view]);

  const fetchCases = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean; silent?: boolean; source?: "poll" }) => {
      if (!opts?.silent) setLoading(true);
      if (opts?.source === "poll") setPolling(true);
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
      let result = { ok: false, changed: false };
      if (res.ok && res.json?.ok) {
        const nextItems = res.json.items ?? [];
        setItems((prev) => (opts?.append ? [...prev, ...nextItems] : nextItems));
        setNextCursor(res.json.nextCursor ?? null);
        setError(null);
        setLastUpdatedAt(new Date().toISOString());
        setStale(false);
        if (!opts?.append) {
          const signature = buildQueueSignature(nextItems);
          const changed = signature !== lastSignatureRef.current;
          lastSignatureRef.current = signature;
          result = { ok: true, changed };
        } else {
          result = { ok: true, changed: false };
        }
      } else {
        const message = res.error?.message ?? "Unable to load cases";
        setError({ message, requestId: res.requestId ?? undefined });
        logMonetisationClientEvent("ops_cases_load_error", null, "ops", { code: res.error?.code ?? "unknown" });
        setStale(true);
      }
      if (!opts?.silent) setLoading(false);
      if (opts?.source === "poll") setPolling(false);
      return result;
    },
    [assigned, breachedOnly, priority, query, sort, status, windowValue]
  );

  const handleViewSelect = useCallback(
    (nextView: ViewKey) => {
      if (nextView === "custom") {
        setView("custom");
        setDraftViewId(null);
        updateQuery({ view: "custom" });
        resetPolling();
        return;
      }

      if (isPresetViewKey(nextView)) {
        const preset = PRESET_VIEW_PRESETS[nextView];
        const nextFilters = buildViewFilters({ ...preset, window: windowValue, sort, q: "" });
        setView(nextView);
        setDraftViewId(null);
        applyFilters(nextFilters);
        updateQuery({ ...nextFilters, view: nextView });
        logMonetisationClientEvent("ops_cases_view_selected", null, "ops", { view: nextView });
        resetPolling();
        return;
      }

      const saved = savedViews.find((item) => item.id === nextView);
      setView(nextView);
      setDraftViewId(nextView);
      if (saved) {
        const nextFilters = normaliseViewFilters(saved.view);
        applyFilters(nextFilters);
        updateQuery({ ...nextFilters, view: nextView });
      } else {
        updateQuery({ view: nextView });
      }
      logMonetisationClientEvent("ops_cases_view_selected", null, "ops", { view: "saved" });
      resetPolling();
    },
    [applyFilters, resetPolling, savedViews, sort, updateQuery, windowValue]
  );

  const handleSaveView = useCallback(async () => {
    if (!activeSavedView) return;
    setViewsError(null);
    const res = await fetchJsonSafe<{ ok: boolean; view?: SavedView }>(`/api/ops/cases/views`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeSavedView.id, view: currentFilters }),
    });
    if (res.ok && res.json?.ok && res.json.view) {
      const nextView = {
        id: res.json.view.id,
        name: res.json.view.name,
        isDefault: Boolean(res.json.view.isDefault),
        view: normaliseViewFilters(res.json.view.view ?? {}),
        createdAt: res.json.view.createdAt ?? null,
        updatedAt: res.json.view.updatedAt ?? null,
      };
      setSavedViews((prev) => prev.map((item) => (item.id === nextView.id ? nextView : item)));
      setView(nextView.id);
      setDraftViewId(nextView.id);
      updateQuery({ ...currentFilters, view: nextView.id });
      logMonetisationClientEvent("ops_cases_view_saved", null, "ops", { view: "saved" });
    } else {
      setViewsError({ message: res.error?.message ?? "Unable to save view", requestId: res.requestId ?? undefined });
    }
  }, [activeSavedView, currentFilters, updateQuery]);

  const handleSaveAs = useCallback(async () => {
    const name = saveAsName.trim();
    if (!name) return;
    setViewsError(null);
    const res = await fetchJsonSafe<{ ok: boolean; view?: SavedView }>(`/api/ops/cases/views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, view: currentFilters }),
    });
    if (res.ok && res.json?.ok && res.json.view) {
      const nextView = {
        id: res.json.view.id,
        name: res.json.view.name,
        isDefault: Boolean(res.json.view.isDefault),
        view: normaliseViewFilters(res.json.view.view ?? {}),
        createdAt: res.json.view.createdAt ?? null,
        updatedAt: res.json.view.updatedAt ?? null,
      };
      setSavedViews((prev) => [...prev, nextView]);
      setRenameDrafts((prev) => ({ ...prev, [nextView.id]: nextView.name }));
      setView(nextView.id);
      setDraftViewId(nextView.id);
      setSaveAsName("");
      setSaveAsOpen(false);
      updateQuery({ ...currentFilters, view: nextView.id });
      logMonetisationClientEvent("ops_cases_view_saved_as", null, "ops", { view: "saved" });
    } else {
      setViewsError({ message: res.error?.message ?? "Unable to save view", requestId: res.requestId ?? undefined });
    }
  }, [currentFilters, saveAsName, updateQuery]);

  const handleRenameView = useCallback(
    async (id: string) => {
      const nextName = renameDrafts[id]?.trim();
      if (!nextName) return;
      setViewsError(null);
      const res = await fetchJsonSafe<{ ok: boolean; view?: SavedView }>(`/api/ops/cases/views`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name: nextName }),
      });
      if (res.ok && res.json?.ok && res.json.view) {
        const updated = {
          id: res.json.view.id,
          name: res.json.view.name,
          isDefault: Boolean(res.json.view.isDefault),
          view: normaliseViewFilters(res.json.view.view ?? {}),
          createdAt: res.json.view.createdAt ?? null,
          updatedAt: res.json.view.updatedAt ?? null,
        };
        setSavedViews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        logMonetisationClientEvent("ops_cases_view_manage", null, "ops", { action: "rename" });
      } else {
        setViewsError({ message: res.error?.message ?? "Unable to rename view", requestId: res.requestId ?? undefined });
      }
    },
    [renameDrafts]
  );

  const handleDeleteView = useCallback(async (id: string) => {
    setViewsError(null);
    const res = await fetchJsonSafe<{ ok: boolean }>(`/api/ops/cases/views`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok && res.json?.ok) {
      setSavedViews((prev) => prev.filter((item) => item.id !== id));
      setRenameDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (view === id) {
        setView("custom");
        updateQuery({ view: "custom" });
      }
      if (draftViewId === id) setDraftViewId(null);
      logMonetisationClientEvent("ops_cases_view_manage", null, "ops", { action: "delete" });
    } else {
      setViewsError({ message: res.error?.message ?? "Unable to delete view", requestId: res.requestId ?? undefined });
    }
  }, [draftViewId, updateQuery, view]);

  const handleSetDefaultView = useCallback(async (id: string) => {
    setViewsError(null);
    const res = await fetchJsonSafe<{ ok: boolean; view?: SavedView }>(`/api/ops/cases/views`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    if (res.ok && res.json?.ok && res.json.view) {
      const updatedId = res.json.view.id;
      setSavedViews((prev) =>
        prev.map((item) =>
          item.id === updatedId ? { ...item, isDefault: true } : { ...item, isDefault: false }
        )
      );
      logMonetisationClientEvent("ops_cases_view_manage", null, "ops", { action: "default" });
    } else {
      setViewsError({ message: res.error?.message ?? "Unable to set default view", requestId: res.requestId ?? undefined });
    }
  }, []);

  useEffect(() => {
    const viewKey = [view, status, assigned, priority, breachedOnly ? "1" : "0", windowValue, sort, query].join("|");
    if (viewLogged.current !== viewKey) {
      logMonetisationClientEvent("ops_cases_view", null, "ops", { window: windowValue, hasQuery: Boolean(query) });
      viewLogged.current = viewKey;
    }
    resetPolling();
    fetchCases({ append: false }).catch(() => undefined);
  }, [assigned, breachedOnly, fetchCases, priority, query, resetPolling, sort, status, view, windowValue]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor) return;
    fetchCases({ cursor: nextCursor, append: true });
    resetPolling();
  }, [fetchCases, nextCursor, resetPolling]);

  useEffect(() => {
    let active = true;
    const schedule = (delay: number) => {
      if (!active) return;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = window.setTimeout(() => pollRunRef.current?.(), delay);
    };

    const runPoll = async () => {
      if (!active) return;
      if (document.visibilityState !== "visible") {
        setStale(true);
        return;
      }
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      const result = await fetchCases({ append: false, silent: true, source: "poll" }).catch(() => ({
        ok: false,
        changed: false,
      }));
      pollInFlight.current = false;
      const changed = Boolean(result?.changed);
      pollDelayRef.current = changed ? 20000 : Math.min(180000, Math.round(pollDelayRef.current * 1.5));
      if (Date.now() - lastPollLogRef.current > 60_000) {
        logMonetisationClientEvent("ops_cases_poll_tick", null, "ops", {
          delayMs: pollDelayRef.current,
          changed,
        });
        lastPollLogRef.current = Date.now();
      }
      schedule(pollDelayRef.current);
    };

    pollRunRef.current = runPoll;
    schedule(pollDelayRef.current);

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        setStale(true);
        return;
      }
      pollDelayRef.current = 20000;
      schedule(pollDelayRef.current);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollRunRef.current = null;
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
        resetPolling();
      } else {
        setActionError({ message: res.error?.message ?? "Unable to claim case", requestId: res.requestId ?? undefined });
      }
    },
    [resetPolling, viewerId]
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
      resetPolling();
    } else {
      setActionError({ message: res.error?.message ?? "Unable to release case", requestId: res.requestId ?? undefined });
    }
  }, [resetPolling]);

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
      resetPolling();
    } else {
      setActionError({ message: res.error?.message ?? "Unable to update status", requestId: res.requestId ?? undefined });
    }
  }, [resetPolling, viewerId]);

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
      resetPolling();
    } else {
      setActionError({ message: res.error?.message ?? "Unable to update priority", requestId: res.requestId ?? undefined });
    }
  }, [resetPolling, viewerId]);

  const handleFilterChange = useCallback(
    (next: { status?: string; assigned?: string; priority?: string; breached?: boolean; window?: string; sort?: string }) => {
      const nextStatus = next.status ?? status;
      const nextAssigned = next.assigned ?? assigned;
      const nextPriority = next.priority ?? priority;
      const nextBreached = next.breached ?? breachedOnly;
      const nextView =
        next.window || next.sort || query
          ? "custom"
          : resolvePresetFromFilters({
              status: nextStatus,
              assigned: nextAssigned,
              priority: nextPriority,
              breached: nextBreached,
            });
      setView(nextView);
      if (nextView !== "custom") {
        setDraftViewId(null);
      }
      updateQuery({ ...next, view: nextView });
      resetPolling();
      logMonetisationClientEvent("ops_cases_filter_change", null, "ops", {
        status: nextStatus,
        assigned: nextAssigned,
        priority: nextPriority,
        window: next.window ?? windowValue,
        hasQuery: Boolean(query),
      });
    },
    [assigned, breachedOnly, priority, query, resetPolling, status, updateQuery, windowValue]
  );

  const handleSortChange = useCallback(
    (nextSort: string) => {
      setSort(nextSort);
      setView("custom");
      updateQuery({ sort: nextSort, view: "custom" });
      resetPolling();
      logMonetisationClientEvent("ops_cases_sort_changed", null, "ops", { sort: nextSort });
    },
    [resetPolling, updateQuery]
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">
              View
              <select
                value={view}
                onChange={(event) => handleViewSelect(event.target.value)}
                className="ml-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                {view !== "custom" && !isPresetViewKey(view) && !savedViews.some((item) => item.id === view) ? (
                  <option value={view}>Saved view</option>
                ) : null}
                <optgroup label="Presets">
                  {PRESET_VIEWS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
                {savedViews.length ? (
                  <optgroup label="Saved">
                    {savedViews.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {view === "custom" ? <option value="custom">Custom</option> : null}
              </select>
            </label>
            {activeSavedView && hasViewChanges ? (
              <button
                type="button"
                onClick={handleSaveView}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Save view
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSaveAsOpen(true);
                setSaveAsName("");
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Save as...
            </button>
            <button
              type="button"
              onClick={() => {
                setManageOpen(true);
                logMonetisationClientEvent("ops_cases_view_manage", null, "ops", { action: "open" });
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Manage views
            </button>
            <CopyIconButton text={queueShareUrl} label="Copy view link" />
            {viewsLoading ? <span className="text-[11px] text-[rgb(var(--muted))]">Loading views...</span> : null}
          </div>
          <div className="text-[11px] text-[rgb(var(--muted))]">
            <span>Last updated: {lastUpdatedAt ? formatShortLocalTime(lastUpdatedAt) : "-"}</span>
            {polling ? (
              <span className="ml-2 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                Auto-refreshing
              </span>
            ) : null}
            {stale ? (
              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                Data stale
              </span>
            ) : null}
          </div>
        </div>

        {saveAsOpen ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">
              View name
              <input
                value={saveAsName}
                onChange={(event) => setSaveAsName(event.target.value)}
                placeholder="e.g. Morning triage"
                className="ml-2 w-48 rounded-full border border-black/10 bg-white px-3 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveAs}
              className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSaveAsOpen(false)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {viewsError ? (
          <div className="mt-3">
            <ErrorBanner title="Views unavailable" message={viewsError.message} requestId={viewsError.requestId ?? undefined} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
          {FILTER_CHIPS.map((chip) => {
            const label = PRESET_VIEWS.find((viewItem) => viewItem.value === chip)?.label ?? chip;
            const active = activePreset === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  handleViewSelect(chip);
                  logMonetisationClientEvent("ops_cases_filter_chip_clicked", null, "ops", { chip });
                }}
                className={`rounded-full px-3 py-1 ${
                  active ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                }`}
              >
                {label}
              </button>
            );
          })}
          {breachedOnly ? (
            <button
              type="button"
              onClick={() => {
                setBreachedOnly(false);
                handleFilterChange({ breached: false });
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-[rgb(var(--muted))]"
            >
              Breached only
            </button>
          ) : null}
          {view === "custom" ? (
            <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-[rgb(var(--muted))]">
              Custom
            </span>
          ) : null}
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
          <button
            type="button"
            onClick={() => {
              const next = !slaInfoOpen;
              setSlaInfoOpen(next);
              if (next) {
                logMonetisationClientEvent("ops_cases_sla_tooltip_opened", null, "ops", {});
              }
            }}
            className="mt-5 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
          >
            SLA rules
          </button>
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
                  const nextView = query
                    ? "custom"
                    : resolvePresetFromFilters({ status, assigned, priority, breached: breachedOnly });
                  setView(nextView);
                  if (nextView !== "custom") setDraftViewId(null);
                  updateQuery({ q: query, view: nextView });
                  resetPolling();
                  logMonetisationClientEvent("ops_cases_filter_change", null, "ops", { hasQuery: Boolean(query) });
                }}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Apply
              </button>
            </div>
          </label>
        </div>
        {slaInfoOpen ? (
          <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[11px] text-[rgb(var(--muted))]">
            <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">SLA policy</p>
            <ul className="mt-1 space-y-1">
              {SLA_POLICY_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
            const slaLabel = formatCaseSlaLabel({
              remainingMs: item.slaRemainingMs,
              breached: item.slaBreached,
              paused: isWaitingStatus(item.status),
            });
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
                      <span> | {formatShortLocalTime(item.lastTouchedAt)}</span>
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
                        {item.userContext.source} | {item.userContext.confidence ?? "unknown"}
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
                      {STATUS_OPTIONS.filter((option) => option.value !== "all" && option.value !== "waiting").map(
                        (option) => (
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
                      {PRIORITY_OPTIONS.filter((option) => option.value !== "all" && option.value !== "p0_p1").map(
                        (option) => (
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
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : null}

      {loading ? <p className="text-[11px] text-[rgb(var(--muted))]">Loading cases...</p> : null}

      {manageOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Views</p>
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">Manage saved views</p>
              </div>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs text-[rgb(var(--muted))]">
              {savedViews.length === 0 ? (
                <p>No saved views yet.</p>
              ) : (
                savedViews.map((item) => {
                  const draftName = renameDrafts[item.id] ?? item.name;
                  const nameChanged = draftName.trim() && draftName.trim() !== item.name;
                  return (
                    <div key={item.id} className="rounded-2xl border border-black/10 bg-white/80 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={draftName}
                          onChange={(event) =>
                            setRenameDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          className="flex-1 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameView(item.id)}
                          disabled={!nameChanged}
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed disabled:text-[rgb(var(--muted))]"
                        >
                          Rename
                        </button>
                        {item.isDefault ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-900">
                            Default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultView(item.id)}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteView(item.id)}
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
