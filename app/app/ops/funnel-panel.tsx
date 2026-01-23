"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type FunnelWindow = {
  windowLabel: string;
  invited: number;
  signed_up: number;
  created_cv: number;
  exported_cv: number;
  created_application: number;
  created_interview: number;
  conversion: { invitedToSignup: number; signupToCv: number; cvToExport: number; exportToApplication: number };
  source?: string;
};

type ApiResponse = {
  windows: FunnelWindow[];
  sources?: string[];
};

export default function FunnelPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedWindow: "24h" | "7d" = ((searchParams?.get("window") as "24h" | "7d" | null) ?? "24h");
  const selectedSource: string = searchParams?.get("source") ?? "all";
  const includeUnknown = searchParams?.get("includeUnknown") !== "0";

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const params = new URLSearchParams({ groupBy: "source" });
    if (selectedWindow) params.set("window", selectedWindow);
    if (selectedSource && selectedSource !== "all") params.set("source", selectedSource);
    if (!includeUnknown) params.set("includeUnknown", "0");
    try {
      logMonetisationClientEvent("ops_funnel_refresh", null, "ops");
      const res = await fetch(`/api/ops/funnel?${params.toString()}`, { method: "GET", cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (res.status === 429 || body?.error?.code === "RATE_LIMITED") {
        setError("Cooldown — try again shortly");
        logMonetisationClientEvent("ops_funnel_rate_limited", null, "ops");
        return;
      }
      if (!body?.ok) {
        setError("Unable to load funnel");
        return;
      }
      setData({ windows: body.summary?.windows ?? [], sources: body.summary?.sources ?? [] });
      logMonetisationClientEvent("ops_funnel_view", null, "ops");
    } catch {
      setError("Unable to load funnel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWindow, selectedSource, includeUnknown]);

  const sources = useMemo<string[]>(() => {
    const base = data?.sources ?? [];
    const merged = Array.from(new Set(["all", ...base.filter(Boolean), includeUnknown ? "unknown" : null].filter(Boolean)));
    return merged as string[];
  }, [data?.sources, includeUnknown]);

  const windowsToRender = useMemo(() => data?.windows?.filter((w) => w.windowLabel === selectedWindow) ?? [], [data?.windows, selectedWindow]);

  const updateFilters = (params: { window?: string; source?: string; includeUnknown?: boolean }) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (params.window) next.set("window", params.window);
    if (params.source !== undefined) {
      if (!params.source || params.source === "all") next.delete("source");
      else next.set("source", params.source);
    }
    if (params.includeUnknown !== undefined) {
      if (params.includeUnknown) next.delete("includeUnknown");
      else next.set("includeUnknown", "0");
    }
    router.replace(`/app/ops/funnel?${next.toString()}`);
    logMonetisationClientEvent("ops_funnel_filter_change", null, "ops", {
      meta: { window: params.window ?? selectedWindow, source: params.source ?? selectedSource, includeUnknown: params.includeUnknown ?? includeUnknown },
    });
  };

  const copyLink = async () => {
    const link = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(link);
      logMonetisationClientEvent("ops_funnel_copy_link", null, "ops");
      setNotice("Link copied");
    } catch {
      setError("Copy failed");
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Funnel</p>
          <h3 className="text-sm font-semibold text-[rgb(var(--ink))]">Invites → First value</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
          >
            Copy link
          </button>
          <Link href="/app/ops/access" className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
            View invites
          </Link>
        </div>
      </div>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--ink))]">
        <div className="flex items-center gap-1">
          <span className="text-[rgb(var(--muted))]">Window</span>
          <select
            value={selectedWindow}
            onChange={(e) => updateFilters({ window: e.target.value })}
            className="rounded-xl border border-black/10 bg-white px-2 py-1 text-xs"
          >
            <option value="24h">24h</option>
            <option value="7d">7d</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[rgb(var(--muted))]">Source</span>
          <select
            value={selectedSource}
            onChange={(e) => updateFilters({ source: e.target.value })}
            className="rounded-xl border border-black/10 bg-white px-2 py-1 text-xs"
          >
            {sources.map((src) => (
              <option key={src} value={src}>
                {src === "all" ? "All sources" : src}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeUnknown} onChange={(e) => updateFilters({ includeUnknown: e.target.checked })} />
          <span className="text-[rgb(var(--muted))]">Include unknown</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {windowsToRender.map((win) => (
          <div key={`${win.windowLabel}-${win.source ?? "all"}`} className="rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-[rgb(var(--ink))]">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              {win.windowLabel} · {win.source ?? "unknown"}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[rgb(var(--muted))]">
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Invited</p>
                <p>{win.invited}</p>
              </div>
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Signed up</p>
                <p>
                  {win.signed_up} ({win.conversion.invitedToSignup}%)
                </p>
              </div>
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Created CV</p>
                <p>
                  {win.created_cv} ({win.conversion.signupToCv}%)
                </p>
              </div>
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Exported CV</p>
                <p>
                  {win.exported_cv} ({win.conversion.cvToExport}%)
                </p>
              </div>
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Applications</p>
                <p>
                  {win.created_application} ({win.conversion.exportToApplication}%)
                </p>
              </div>
              <div>
                <p className="text-[rgb(var(--ink))] font-semibold">Interviews</p>
                <p>{win.created_interview}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-[rgb(var(--muted))]">
        <Link href="/app/ops/access" className="underline">
          Grant access
        </Link>
        <Link href="/app/ops/audits" className="underline">
          Open audits
        </Link>
        <Link href="/app/ops/incidents" className="underline">
          Open incidents
        </Link>
      </div>
    </div>
  );
}
