"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Summary = {
  myAssignedCount: number;
  unassignedCount: number;
  ageingBuckets: { over1h: number; over6h: number; over24h: number };
  statusCounts: Record<string, number>;
};

export default function CasesQueueCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const lastGood = useRef<Summary | null>(null);
  const viewLogged = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const res = await fetchJsonSafe<{ ok: boolean; summary?: Summary }>("/api/ops/cases/summary", {
        method: "GET",
        cache: "no-store",
      });
      if (!active) return;
      if (res.ok && res.json?.ok) {
        setSummary(res.json.summary ?? null);
        lastGood.current = res.json.summary ?? null;
        setError(null);
        if (!viewLogged.current) {
          logMonetisationClientEvent("ops_cases_summary_view", null, "ops", {});
          viewLogged.current = true;
        }
      } else {
        setSummary(lastGood.current);
        setError({ message: res.error?.message ?? "Unable to load case summary", requestId: res.requestId ?? undefined });
        logMonetisationClientEvent("ops_cases_load_error", null, "ops", { code: res.error?.code ?? "summary" });
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">My queue</p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Assigned + unassigned workload</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link href="/app/ops/cases?assigned=me" className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]">
            View my queue
          </Link>
          <Link href="/app/ops/cases?assigned=unassigned" className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]">
            View unassigned
          </Link>
        </div>
      </div>
      {error ? (
        <div className="mt-2">
          <ErrorBanner title="Queue summary unavailable" message={error.message} requestId={error.requestId ?? undefined} />
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Assigned to me</p>
          <p className="text-2xl font-semibold text-[rgb(var(--ink))]">{summary?.myAssignedCount ?? 0}</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">Active cases</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Unassigned</p>
          <p className="text-2xl font-semibold text-[rgb(var(--ink))]">{summary?.unassignedCount ?? 0}</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">Needs pickup</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ageing</p>
          <div className="mt-1 space-y-1 text-[11px] text-[rgb(var(--muted))]">
            <p>&gt;1h: <span className="font-semibold text-[rgb(var(--ink))]">{summary?.ageingBuckets.over1h ?? 0}</span></p>
            <p>&gt;6h: <span className="font-semibold text-[rgb(var(--ink))]">{summary?.ageingBuckets.over6h ?? 0}</span></p>
            <p>&gt;24h: <span className="font-semibold text-[rgb(var(--ink))]">{summary?.ageingBuckets.over24h ?? 0}</span></p>
          </div>
        </div>
      </div>
      {loading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Refreshing queue…</p> : null}
    </div>
  );
}
