"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type FunnelResponse = {
  ok: boolean;
  range: string;
  counts: {
    activation_view: number;
    activation_step_click: number;
    activation_primary_cta_click: number;
    activation_cta_click: number;
    activation_completed: number;
    activation_model_error: Record<string, number>;
    activation_skip_week: number;
    activation_funnel_view: number;
    activation_funnel_export: number;
  };
  stepClicks: Record<string, number>;
  ctaClicks: Record<string, number>;
  milestones: {
    first_application: number;
    first_outreach: number;
    first_followup: number;
    first_outcome: number;
  };
};

type Props = {
  initialRange: "7d" | "24h";
};

export default function ActivationFunnelClient({ initialRange }: Props) {
  const [range, setRange] = useState<"7d" | "24h">(initialRange);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState<{ requestId?: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (nextRange: "7d" | "24h") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/activation-funnel?range=${nextRange}`, { cache: "no-store" });
      const requestId = res.headers.get("x-request-id") ?? undefined;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError({ requestId, message: body?.error?.message ?? "Unable to load activation funnel." });
        setData(null);
        return;
      }
      const body = (await res.json()) as FunnelResponse;
      setData(body);
      setRange(nextRange);
    } catch (err) {
      setError({ requestId: undefined, message: (err as Error)?.message ?? "Unable to load activation funnel." });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(initialRange);
    logMonetisationClientEvent("activation_funnel_view", null, "ops", { range: initialRange });
  }, [initialRange]);

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Activation metrics</p>
          <p className="text-xs text-[rgb(var(--muted))]">Counts only, masked and aggregated.</p>
        </div>
        <div className="flex gap-2 text-xs">
          {["7d", "24h"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => fetchData(value as "7d" | "24h")}
              className={`rounded-full px-3 py-1 font-semibold ${
                range === value ? "bg-[rgb(var(--accent))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          title="Unable to load activation funnel"
          message={error.message}
          requestId={error.requestId}
          onRetry={() => fetchData(range)}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Views" value={data?.counts.activation_view ?? 0} />
        <Metric label="Step clicks" value={data?.counts.activation_step_click ?? 0} />
        <Metric label="CTA clicks" value={(data?.counts.activation_cta_click ?? 0) + (data?.counts.activation_primary_cta_click ?? 0)} />
        <Metric label="Completed" value={data?.counts.activation_completed ?? 0} />
        <Metric label="Skips" value={data?.counts.activation_skip_week ?? 0} />
        <Metric label="Model errors" value={Object.values(data?.counts.activation_model_error ?? {}).reduce((a, b) => a + b, 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Step breakdown">
          {Object.keys(data?.stepClicks ?? {}).length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted))]">No step clicks yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {Object.entries(data?.stepClicks ?? {}).map(([id, count]) => (
                <li key={id} className="flex justify-between">
                  <span className="font-semibold text-[rgb(var(--ink))]">{id}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="CTA breakdown">
          {Object.keys(data?.ctaClicks ?? {}).length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted))]">No CTA clicks yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {Object.entries(data?.ctaClicks ?? {}).map(([id, count]) => (
                <li key={id} className="flex justify-between">
                  <span className="font-semibold text-[rgb(var(--ink))]">{id}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Time-to-first-value proxies">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          <Metric label="First app created" value={data?.milestones.first_application ?? 0} />
          <Metric label="First outreach" value={data?.milestones.first_outreach ?? 0} />
          <Metric label="First follow-up" value={data?.milestones.first_followup ?? 0} />
          <Metric label="First outcome" value={data?.milestones.first_outcome ?? 0} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
        <p>Counts are aggregated; no user identifiers returned.</p>
        <Link href="/app/ops/audits?action=activation_model_error" className="font-semibold text-[rgb(var(--accent-strong))] hover:underline">
          View related audits
        </Link>
      </div>

      {loading ? <p className="text-xs text-[rgb(var(--muted))]">Refreshing...</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{label}</p>
      <p className="text-lg font-semibold text-[rgb(var(--ink))]">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
      <p className="text-sm font-semibold text-[rgb(var(--ink))]">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
