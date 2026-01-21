"use client";

import { useCallback, useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { EffectivenessInsights } from "@/lib/ops/resolution-effectiveness";
import type { EffectivenessState } from "@/lib/ops/ops-resolution-outcomes";

type Summary = Awaited<ReturnType<typeof import("@/lib/ops/ops-resolution-outcomes").summariseResolutionOutcomes>>;

type Props = {
  initialSummary: Summary;
};

type WindowFilter = "24h" | "7d";

type MaskedOutcome = {
  id: string | null;
  code: string;
  createdAt: string;
  requestId: string | null;
  userId: string | null;
  userIdMasked: string | null;
  actorMasked: string | null;
  noteMasked: string | null;
  effectivenessState: EffectivenessState;
  effectivenessReason: string | null;
  effectivenessNote: string | null;
  effectivenessSource: string | null;
  effectivenessUpdatedAt: string | null;
  effectivenessDeferredUntil: string | null;
};

export default function ResolutionsClient({ initialSummary }: Props) {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("24h");
  const [outcomeCode, setOutcomeCode] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [activeTab, setActiveTab] = useState<"summary" | "due">("summary");
  const [dueItems, setDueItems] = useState<MaskedOutcome[]>([]);
  const [dueInsights, setDueInsights] = useState<EffectivenessInsights | null>(null);
  const [dueCounts, setDueCounts] = useState<{ due?: number }>({});
  const [dueLoading, setDueLoading] = useState(false);
  const [dueError, setDueError] = useState<string | null>(null);
  const [dueViewLogged, setDueViewLogged] = useState(false);
  const [insightsLogged, setInsightsLogged] = useState(false);

  const recent = summary.recent ?? [];
  const totals = summary.totals ?? { count: 0, uniqueUsers: 0, uniqueRequestIds: 0 };
  const dueTotal = dueCounts.due ?? dueItems.length;

  const fetchSummary = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("window", windowFilter === "7d" ? "7d" : "24h");
    if (outcomeCode) params.set("outcomeCode", outcomeCode);
    if (userId) params.set("userId", userId);
    logMonetisationClientEvent("ops_resolution_summary_filter_change", null, "ops", { window: params.get("window") });
    const res = await fetch(`/api/ops/resolution-outcomes/summary?${params.toString()}`, { method: "GET", cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (body?.summary) setSummary(body.summary);
  }, [windowFilter, outcomeCode, userId]);

  const fetchDue = useCallback(async () => {
    setDueLoading(true);
    setDueError(null);
    const params = new URLSearchParams();
    params.set("due", "1");
    params.set("range", windowFilter);
    const res = await fetch(`/api/ops/resolution-effectiveness?${params.toString()}`, { method: "GET", cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!body?.ok) {
      setDueError(body?.error?.message ?? "Unable to load due reviews");
    } else {
      setDueItems(body.items ?? []);
      setDueInsights(body.insights ?? null);
      setDueCounts(body.counts ?? {});
      if (!insightsLogged && body.insights) {
        logMonetisationClientEvent("ops_resolutions_insights_view", null, "ops", { range: windowFilter });
        setInsightsLogged(true);
      }
    }
    setDueLoading(false);
  }, [windowFilter, insightsLogged]);

  useEffect(() => {
    if (activeTab !== "summary") return;
    logMonetisationClientEvent("ops_resolution_summary_view", null, "ops", { window: windowFilter });
  }, [activeTab, windowFilter]);

  useEffect(() => {
    if (activeTab !== "due") return;
    if (!dueViewLogged) {
      logMonetisationClientEvent("ops_resolutions_due_view", null, "ops", { range: windowFilter });
      setDueViewLogged(true);
    }
    if (dueItems.length === 0 && !dueLoading) {
      fetchDue();
    }
  }, [activeTab, dueItems.length, dueLoading, dueViewLogged, fetchDue, windowFilter]);

  const exportJson = () => {
    logMonetisationClientEvent("ops_resolution_export_click", null, "ops", { format: "json" });
    const payload = { masked: true, note: "masked export", recent };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resolutions.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    logMonetisationClientEvent("ops_resolution_export_click", null, "ops", { format: "csv" });
    const header = ["at", "code", "requestId", "userIdMasked", "actorMasked", "noteMasked"].join(",");
    const rows = recent.map((r) =>
      [r.at, r.code, r.requestId ?? "", r.userIdMasked ?? "", r.actorMasked ?? "", (r as any).noteMasked ?? ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([["# masked export", header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resolutions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-black/10 bg-white text-sm font-semibold">
          {(["summary", "due"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`px-3 py-1 ${activeTab === tab ? "bg-black/80 text-white" : "text-[rgb(var(--ink))]"}`}
              onClick={() => {
                setActiveTab(tab);
                if (tab === "due") setWindowFilter("7d");
              }}
            >
              {tab === "summary" ? "Summary" : "Due reviews"}
            </button>
          ))}
        </div>
        <select value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as WindowFilter)} className="rounded-md border px-2 py-1 text-sm">
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
        </select>
        {activeTab === "summary" ? (
          <>
            <input
              value={outcomeCode}
              onChange={(e) => setOutcomeCode(e.target.value)}
              placeholder="Outcome code"
              className="rounded-md border px-2 py-1 text-sm"
            />
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded-md border px-2 py-1 text-sm" />
          </>
        ) : null}
        <button
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold"
          onClick={activeTab === "summary" ? fetchSummary : fetchDue}
        >
          Apply
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportJson}>
          Export JSON
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {activeTab === "summary" ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Total</p>
              <p className="text-2xl font-semibold text-[rgb(var(--ink))]">{totals.count}</p>
              <p className="text-xs text-[rgb(var(--muted))]">
                Users {totals.uniqueUsers} · Requests {totals.uniqueRequestIds}
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Top outcomes</p>
              <ul className="mt-1 space-y-1 text-sm">
                {(summary.topOutcomes ?? []).map((o) => (
                  <li key={o.code}>
                    {o.code} — <span className="font-semibold">{o.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Top actors</p>
              <ul className="mt-1 space-y-1 text-sm">
                {(summary.topActors ?? []).map((o) => (
                  <li key={o.actorMasked}>
                    {o.actorMasked} — <span className="font-semibold">{o.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent outcomes</p>
            </div>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="text-[rgb(var(--muted))]">
                    <th className="px-2 py-1">At</th>
                    <th className="px-2 py-1">Code</th>
                    <th className="px-2 py-1">Request</th>
                    <th className="px-2 py-1">User</th>
                    <th className="px-2 py-1">Actor</th>
                    <th className="px-2 py-1">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={`${r.at}-${r.requestId ?? ""}`} className="border-t">
                      <td className="px-2 py-1">{r.at}</td>
                      <td className="px-2 py-1">{r.code}</td>
                      <td className="px-2 py-1">
                        {r.requestId ? (
                          <a href={`/app/ops/incidents?requestId=${encodeURIComponent(r.requestId)}`} className="underline">
                            {r.requestId}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-1">{r.userIdMasked ?? "—"}</td>
                      <td className="px-2 py-1">{r.actorMasked ?? "—"}</td>
                      <td className="px-2 py-1">{(r as any).noteMasked ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-800">Top failed outcomes (7d)</p>
              <ul className="mt-1 space-y-1 text-xs text-indigo-900">
                {(dueInsights?.topFailedCodes ?? []).map((item) => (
                  <li key={item.code} className="flex justify-between">
                    <span>{item.code}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
                {(dueInsights?.topFailedCodes ?? []).length === 0 ? <li className="text-[rgb(var(--muted))]">No failures yet.</li> : null}
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-800">Common fail reasons (7d)</p>
              <ul className="mt-1 space-y-1 text-xs text-indigo-900">
                {(dueInsights?.topFailReasons ?? []).map((item) => (
                  <li key={`${item.reason}-${item.count}`} className="flex justify-between">
                    <span>{item.reason}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
                {(dueInsights?.topFailReasons ?? []).length === 0 ? <li className="text-[rgb(var(--muted))]">No reasons logged.</li> : null}
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-800">Repeat failed requests (24h)</p>
              <ul className="mt-1 space-y-1 text-xs text-indigo-900">
                {(dueInsights?.repeatFailedRequestIds ?? []).map((item) => (
                  <li key={item.requestId} className="flex justify-between">
                    <span>{item.requestId}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
                {(dueInsights?.repeatFailedRequestIds ?? []).length === 0 ? <li className="text-[rgb(var(--muted))]">No repeats detected.</li> : null}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-3" data-testid="due-reviews">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Due reviews {dueTotal ? `(${dueTotal})` : ""}
              </p>
              {dueLoading ? <span className="text-xs text-[rgb(var(--muted))]">Loading…</span> : null}
            </div>
            {dueError ? <p className="text-xs text-rose-700">Error: {dueError}</p> : null}
            <div className="mt-2 space-y-2">
              {dueItems.length === 0 && !dueLoading ? <p className="text-xs text-[rgb(var(--muted))]">No reviews due right now.</p> : null}
              {dueItems.map((item) => (
                <div key={item.id ?? `${item.code}-${item.requestId ?? ""}-${item.createdAt}`} className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.code}</p>
                      <p className="text-[11px] text-[rgb(var(--muted))]">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-800">Review pending</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.requestId ? (
                      <a href={`/app/ops/incidents?requestId=${encodeURIComponent(item.requestId)}&from=ops_resolutions`} className="underline">
                        Request {item.requestId}
                      </a>
                    ) : null}
                    {item.userId ? (
                      <a href={`/app/ops/users/${item.userId}`} className="underline">
                        Open dossier
                      </a>
                    ) : null}
                    {item.effectivenessReason ? (
                      <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">Reason: {item.effectivenessReason}</span>
                    ) : null}
                  </div>
                  {item.effectivenessNote ? <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">Note: {item.effectivenessNote}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
