"use client";

import { useEffect, useMemo, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Summary = Awaited<ReturnType<typeof import("@/lib/ops/ops-resolution-outcomes").summariseResolutionOutcomes>>;

type Props = {
  initialSummary: Summary;
};

type WindowFilter = "24h" | "7d";

export default function ResolutionsClient({ initialSummary }: Props) {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("24h");
  const [outcomeCode, setOutcomeCode] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const recent = summary.recent ?? [];

  useEffect(() => {
    logMonetisationClientEvent("ops_resolution_summary_view", null, "ops", { window: windowFilter });
  }, [windowFilter]);

  const fetchSummary = async () => {
    const params = new URLSearchParams();
    params.set("window", windowFilter === "7d" ? "7d" : "24h");
    if (outcomeCode) params.set("outcomeCode", outcomeCode);
    if (userId) params.set("userId", userId);
    logMonetisationClientEvent("ops_resolution_summary_filter_change", null, "ops", { window: params.get("window") });
    const res = await fetch(`/api/ops/resolution-outcomes/summary?${params.toString()}`, { method: "GET", cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (body?.summary) setSummary(body.summary);
  };

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

  const totals = summary.totals ?? { count: 0, uniqueUsers: 0, uniqueRequestIds: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={windowFilter} onChange={(e) => setWindowFilter(e.target.value as WindowFilter)} className="rounded-md border px-2 py-1 text-sm">
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
        </select>
        <input
          value={outcomeCode}
          onChange={(e) => setOutcomeCode(e.target.value)}
          placeholder="Outcome code"
          className="rounded-md border px-2 py-1 text-sm"
        />
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded-md border px-2 py-1 text-sm" />
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={fetchSummary}>
          Apply
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportJson}>
          Export JSON
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
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
    </div>
  );
}
