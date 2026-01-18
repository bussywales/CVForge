"use client";

import { useMemo, useState } from "react";
import CopyIconButton from "@/components/CopyIconButton";
import { OPS_INCIDENTS_COPY } from "@/lib/ops/incidents.microcopy";
import {
  type IncidentRecord,
  type IncidentGroup,
  groupIncidents,
  correlateIncidents,
} from "@/lib/ops/incidents-shared";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

type Props = {
  incidents: IncidentRecord[];
  initialLookup?: IncidentRecord | null;
};

type TimeFilter = "1" | "24" | "168";

function applyFilters(
  incidents: IncidentRecord[],
  filters: {
    time: TimeFilter;
    surface: string;
    code: string;
    flow: string;
    search: string;
    highImpact: boolean;
  }
) {
  const now = Date.now();
  const windowMs = Number(filters.time) * 60 * 60 * 1000;
  const term = filters.search.toLowerCase().trim();
  const highImpactSurfaces: Array<IncidentRecord["surface"]> = ["billing", "checkout", "portal"];
  return incidents.filter((inc) => {
    if (now - new Date(inc.at).getTime() > windowMs) return false;
    if (filters.surface !== "all" && inc.surface !== filters.surface) return false;
    if (filters.code && inc.code !== filters.code) return false;
    if (filters.flow) {
      const flow = inc.flow ?? (inc.context?.flow as string | undefined) ?? (inc.context?.from as string | undefined);
      if (flow !== filters.flow) return false;
    }
    if (filters.highImpact && !highImpactSurfaces.includes(inc.surface)) return false;
    if (term) {
      const haystack = `${inc.requestId} ${inc.message ?? ""} ${inc.code ?? ""} ${inc.emailMasked ?? ""} ${inc.userId ?? ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function formatDate(value: string) {
  const d = new Date(value);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function exportCsv(groups: IncidentGroup[]) {
  const header = ["groupKey", "surface", "code", "message", "flow", "count", "firstSeen", "lastSeen", "sampleRequestIds"].join(",");
  const rows = groups.map((g) =>
    [
      `"${g.key}"`,
      g.surface,
      g.code ?? "",
      `"${(g.message ?? "").replace(/"/g, '""')}"`,
      g.flow ?? "",
      g.count,
      g.firstSeen,
      g.lastSeen,
      `"${g.sampleRequestIds.join(" ")}"`,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export default function IncidentsClient({ incidents, initialLookup }: Props) {
  const [filters, setFilters] = useState({
    time: "24" as TimeFilter,
    surface: "all",
    code: "",
    flow: "",
    search: "",
    highImpact: false,
  });
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<IncidentRecord | null>(initialLookup ?? null);

  const filtered = useMemo(() => applyFilters(incidents, filters), [incidents, filters]);
  const groups = useMemo(() => groupIncidents(filtered), [filtered]);
  const codes = useMemo(() => Array.from(new Set(filtered.map((i) => i.code).filter(Boolean))) as string[], [filtered]);
  const flows = useMemo(
    () =>
      Array.from(
        new Set(
          filtered
            .map((i) => i.flow ?? (i.context?.flow as string | undefined) ?? (i.context?.from as string | undefined))
            .filter(Boolean)
        )
      ) as string[],
    [filtered]
  );
  const related = selected ? correlateIncidents(selected, incidents) : [];

  const handleExport = (type: "csv" | "json") => {
    if (groups.length > 500) {
      alert(OPS_INCIDENTS_COPY.exportLimit);
      return;
    }
    if (type === "csv") {
      const csv = exportCsv(groups);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "incidents.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const payload = groups.map((g) => ({
        key: g.key,
        surface: g.surface,
        code: g.code,
        message: g.message,
        flow: g.flow,
        count: g.count,
        firstSeen: g.firstSeen,
        lastSeen: g.lastSeen,
        sampleRequestIds: g.sampleRequestIds,
        incidents: g.incidents.slice(0, 5).map((i) => ({
          at: i.at,
          requestId: i.requestId,
          userId: i.userId,
          emailMasked: i.emailMasked,
          flow: i.flow ?? i.context?.flow ?? i.context?.from,
          path: i.path ?? i.context?.path,
          code: i.code,
          message: i.message,
        })),
      }));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "incidents.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs">
        <div className="flex items-center gap-2">
          <label>
            {OPS_INCIDENTS_COPY.filters.timeLabel}
            <select
              className="ml-1 rounded-md border border-black/10 px-2 py-1"
              value={filters.time}
              onChange={(e) => setFilters((f) => ({ ...f, time: e.target.value as TimeFilter }))}
            >
              <option value="1">{OPS_INCIDENTS_COPY.filters.time1h}</option>
              <option value="24">{OPS_INCIDENTS_COPY.filters.time24h}</option>
              <option value="168">{OPS_INCIDENTS_COPY.filters.time7d}</option>
            </select>
          </label>
          <label>
            {OPS_INCIDENTS_COPY.filters.surfaceLabel}
            <select
              className="ml-1 rounded-md border border-black/10 px-2 py-1"
              value={filters.surface}
              onChange={(e) => setFilters((f) => ({ ...f, surface: e.target.value }))}
            >
              <option value="all">{OPS_INCIDENTS_COPY.filters.surfaceAll}</option>
              {["billing", "checkout", "portal", "outcomes", "outreach", "referrals", "diagnostics", "other"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {OPS_INCIDENTS_COPY.filters.codeLabel}
            <select
              className="ml-1 rounded-md border border-black/10 px-2 py-1"
              value={filters.code}
              onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
            >
              <option value="">All</option>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            {OPS_INCIDENTS_COPY.filters.flowLabel}
            <select
              className="ml-1 rounded-md border border-black/10 px-2 py-1"
              value={filters.flow}
              onChange={(e) => setFilters((f) => ({ ...f, flow: e.target.value }))}
            >
              <option value="">All</option>
              {flows.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filters.highImpact}
              onChange={(e) => setFilters((f) => ({ ...f, highImpact: e.target.checked }))}
            />
            {OPS_INCIDENTS_COPY.filters.highImpact}
          </label>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder={OPS_INCIDENTS_COPY.filters.searchPlaceholder}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-full rounded-md border border-black/10 px-3 py-1"
          />
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            onClick={() => handleExport("json")}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.groupEmpty}</p>
        ) : (
          groups.map((group) => {
            const expanded = expandedGroup === group.key;
                  return (
                    <div key={group.key} className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-[rgb(var(--muted))]">
                            {group.surface} • {group.code ?? "No code"} • {group.flow ?? "—"}
                          </p>
                          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{group.message ?? "No message"}</p>
                          <p className="text-[11px] text-[rgb(var(--muted))]">
                            {group.count} occurrences · {formatDate(group.firstSeen)} → {formatDate(group.lastSeen)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyIconButton text={group.sampleRequestIds.join("\n")} label="Copy ref IDs" />
                    <button
                      type="button"
                      className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                      onClick={() => setExpandedGroup(expanded ? null : group.key)}
                    >
                      {expanded ? "Hide" : "Expand"}
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div className="mt-3 space-y-2">
                    {group.incidents.map((inc) => {
                      const snippet = buildSupportSnippet({
                        action: inc.surface,
                        path: inc.path ?? inc.returnTo ?? "",
                        requestId: inc.requestId,
                        code: inc.code ?? undefined,
                      });
                      const flowLabel =
                        inc.flow ??
                        (inc.context?.flow as string | undefined) ??
                        (inc.context?.from as string | undefined) ??
                        "—";
                      return (
                        <div
                          key={inc.requestId + inc.at}
                          className="rounded-xl border border-black/5 bg-white px-3 py-2 text-xs text-[rgb(var(--muted))]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-1">
                              <p className="font-semibold text-[rgb(var(--ink))]">{formatDate(inc.at)}</p>
                              <p>
                                Ref {inc.requestId} · {inc.emailMasked ?? "user unknown"} · flow {flowLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <CopyIconButton text={inc.requestId} label="Copy ref" />
                              <CopyIconButton text={snippet} label={OPS_INCIDENTS_COPY.copySnippet} />
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                                onClick={() => setSelected(inc)}
                              >
                                View related
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {selected ? (
        <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.recentTitle}</p>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Related events nearby</p>
            </div>
            <CopyIconButton
              text={buildSupportSnippet({
                action: selected.surface,
                path: selected.path ?? selected.returnTo ?? "",
                requestId: selected.requestId,
                code: selected.code ?? undefined,
              })}
              label={OPS_INCIDENTS_COPY.copySnippet}
            />
          </div>
          <div className="mt-3 space-y-2">
            {related.map((inc) => (
              <div key={inc.requestId + inc.at} className="rounded-xl border border-black/5 bg-white px-3 py-2 text-xs text-[rgb(var(--muted))]">
                <p className="font-semibold text-[rgb(var(--ink))]">{formatDate(inc.at)}</p>
                <p>
                  {inc.surface} • {inc.code ?? "No code"} • Ref {inc.requestId}
                </p>
                <p>{inc.message ?? "No message"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
