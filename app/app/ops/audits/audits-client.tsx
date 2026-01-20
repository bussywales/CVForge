"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import CopyIconButton from "@/components/CopyIconButton";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildAuditCsv } from "@/lib/ops/audits-export";
import { buildSupportBundleFromAudit } from "@/lib/ops/support-bundle";
import { buildIncidentsLink } from "@/lib/ops/incidents-shared";

type AuditItem = {
  id: string;
  at: string;
  action: string;
  actor: { id: string; email?: string | null; role?: string | null } | null;
  target: { userId?: string | null } | null;
  ref?: string;
  requestId?: string;
  meta?: any;
};

type PageInfo = { hasMore: boolean; nextCursor?: string | null };
type SearchError = { message?: string | null; requestId?: string | null; code?: string | null };

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export default function AuditsClient({ initialUserId, initialQuery }: { initialUserId?: string | null; initialQuery?: string | null }) {
  const [userId, setUserId] = useState(initialUserId ?? "");
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [q, setQ] = useState(initialQuery ?? "");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [page, setPage] = useState<PageInfo>({ hasMore: false, nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);

  const createdFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    []
  );

  const fetchAudits = async (opts?: { cursor?: string | null; reset?: boolean }) => {
    const params = new URLSearchParams();
    if (userId.trim()) params.set("userId", userId.trim());
    if (actorId.trim()) params.set("actorId", actorId.trim());
    if (action.trim()) params.set("action", action.trim());
    if (since.trim()) params.set("since", since.trim());
    if (until.trim()) params.set("until", until.trim());
    if (q.trim()) params.set("q", q.trim());
    if (opts?.cursor) params.set("cursor", opts.cursor);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/audits?${params.toString()}`, { method: "GET" });
      const requestId = res.headers.get("x-request-id");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError({
          message: data?.error?.message ?? "Unable to load audits.",
          requestId: data?.error?.requestId ?? requestId,
          code: data?.error?.code,
        });
        return;
      }
      setItems((prev) => (opts?.reset ? data.items : [...prev, ...data.items]));
      setPage(data.page ?? { hasMore: false });
    } catch {
      setError({ message: "Unable to load audits.", code: "NETWORK" });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    fetchAudits({ reset: true });
    try {
      logMonetisationClientEvent("ops_audits_filter_apply", null, "ops", {
        hashedQuery: q ? hashString(q) : null,
        hasUser: Boolean(userId),
        hasActor: Boolean(actorId),
        hasAction: Boolean(action),
      });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchAudits({ reset: true });
    try {
      logMonetisationClientEvent("ops_audits_view", null, "ops");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportJson = () => {
    const payload = { masked: true, note: "masked export", items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audits.json";
    link.click();
    URL.revokeObjectURL(url);
    try {
      logMonetisationClientEvent("ops_audits_export_json", null, "ops");
    } catch {
      /* ignore */
    }
  };

  const exportCsv = () => {
    const csv = ["# masked export", buildAuditCsv(items)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audits.csv";
    link.click();
    URL.revokeObjectURL(url);
    try {
      logMonetisationClientEvent("ops_audits_export_csv", null, "ops");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Filters</p>
            <p className="text-xs text-[rgb(var(--muted))]">Apply user, actor, action, date, or text search.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              onClick={exportJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              onClick={exportCsv}
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">User ID</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="target user"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Actor ID</label>
            <input
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="actor user"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="comma-separated"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Since</label>
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Until</label>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="action/ref/requestId"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
          >
            {loading ? "Loading..." : "Apply filters"}
          </button>
          {page.hasMore ? <span className="text-[10px] text-[rgb(var(--muted))]">Showing limited results (load more below).</span> : null}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          title="Unable to load audits"
          message={error.message ?? "Unable to load audits."}
          requestId={error.requestId ?? undefined}
        />
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Audit trail</p>
          <p className="text-[10px] text-[rgb(var(--muted))]">{items.length} entries</p>
        </div>
        {items.length === 0 && !loading && !error ? (
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">No audit entries found.</p>
        ) : null}
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-[rgb(var(--muted))]">
            <thead className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Meta</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const bundle = buildSupportBundleFromAudit(item);
                return (
                  <tr key={item.id} className="border-t border-black/5">
                    <td className="px-3 py-2 text-[rgb(var(--ink))]">{createdFormatter.format(new Date(item.at))}</td>
                    <td className="px-3 py-2 text-[rgb(var(--ink))]">
                      <div className="space-y-1">
                        <p>{item.action}</p>
                        {item.requestId ? (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-blue-700 underline-offset-2 hover:underline"
                            onClick={() => {
                              logMonetisationClientEvent("ops_audits_open_incidents_click", null, "ops");
                              window.open(buildIncidentsLink(item.requestId ?? ""), "_blank");
                            }}
                          >
                            Open in Incidents
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {item.actor ? (
                        <div className="space-y-0.5">
                          <p className="text-[rgb(var(--ink))]">{item.actor.email ?? "—"}</p>
                          <p className="text-[10px] text-[rgb(var(--muted))]">
                            {item.actor.role ?? "—"} · {item.actor.id}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-[rgb(var(--ink))]">
                      {item.target?.userId ? (
                        <div className="space-y-1">
                          <Link
                            href={`/app/ops/users/${item.target.userId}`}
                            className="text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                          >
                            {item.target.userId}
                          </Link>
                          <Link
                            href={`/app/ops/audits?userId=${item.target.userId}`}
                            className="text-[10px] text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                          >
                            Audits for user
                          </Link>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-[rgb(var(--ink))]">
                      <div className="space-y-1">
                        <p>{item.ref ?? "—"}</p>
                        {item.requestId ? (
                          <div className="flex items-center gap-1">
                            <Link
                              href={buildIncidentsLink(item.requestId ?? "")}
                              onClick={() => logMonetisationClientEvent("ops_audits_open_incidents_click", null, "ops")}
                              className="font-mono text-[10px] text-blue-700 underline-offset-2 hover:underline"
                            >
                              {item.requestId}
                            </Link>
                            <CopyIconButton text={item.requestId} label="Copy" />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <details className="text-[10px] space-y-1">
                        <summary
                          className="cursor-pointer text-[rgb(var(--ink))]"
                          onClick={() => logMonetisationClientEvent("ops_support_bundle_view", null, "ops")}
                        >
                          View
                        </summary>
                        <pre className="mt-1 max-w-xs overflow-auto rounded border border-black/10 bg-white px-2 py-1 text-[10px] text-[rgb(var(--muted))]">
                          {JSON.stringify(item.meta ?? {}, null, 2)}
                        </pre>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
                          <p className="font-semibold text-[rgb(var(--ink))]">Support bundle</p>
                          <p className="text-[rgb(var(--muted))]">{bundle.summary}</p>
                          <p className="text-[rgb(var(--muted))]">Next: {bundle.nextAction}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <CopyIconButton
                              text={bundle.snippet}
                              label="Copy snippet"
                              onCopy={() => logMonetisationClientEvent("ops_support_bundle_copy", null, "ops")}
                            />
                            <CopyIconButton
                              text={JSON.stringify(bundle, null, 2)}
                              label="Copy bundle"
                              onCopy={() => logMonetisationClientEvent("ops_support_bundle_copy", null, "ops")}
                            />
                          </div>
                          {item.requestId ? (
                            <button
                              type="button"
                              className="mt-1 text-[10px] font-semibold text-blue-700 underline-offset-2 hover:underline"
                              onClick={() => {
                                logMonetisationClientEvent("ops_audits_open_incidents_click", null, "ops");
                                window.open(buildIncidentsLink(item.requestId ?? ""), "_blank");
                              }}
                            >
                              Open in Incidents
                            </button>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {page.hasMore ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => fetchAudits({ cursor: page.nextCursor ?? undefined })}
              disabled={loading}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed disabled:bg-black/10"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
