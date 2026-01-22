"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
};

export default function FunnelPanel() {
  const [data, setData] = useState<FunnelWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      logMonetisationClientEvent("ops_funnel_refresh", null, "ops");
      const res = await fetch("/api/ops/funnel", { method: "GET", cache: "no-store" });
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
      setData(body.summary?.windows ?? null);
      logMonetisationClientEvent("ops_funnel_view", null, "ops");
    } catch {
      setError("Unable to load funnel");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const window24 = data?.find((w) => w.windowLabel === "24h");
  const window7d = data?.find((w) => w.windowLabel === "7d");

  const renderWindow = (win: FunnelWindow | undefined) => {
    if (!win) return null;
    return (
      <div className="rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-[rgb(var(--ink))]">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{win.windowLabel}</p>
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
    );
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
          <Link href="/app/ops/access" className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
            View invites
          </Link>
        </div>
      </div>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {renderWindow(window24)}
        {renderWindow(window7d)}
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
