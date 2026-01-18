import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseUser } from "@/lib/data/supabase";
import { isOpsAdmin } from "@/lib/ops/auth";
import { getIncidentByRequestId, getRecentIncidentEvents, type IncidentRecord, type IncidentSurface } from "@/lib/ops/incidents";
import { OPS_INCIDENTS_COPY } from "@/lib/ops/incidents.microcopy";
import CopyIconButton from "@/components/CopyIconButton";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

export const dynamic = "force-dynamic";

function IncidentCard({ incident }: { incident: IncidentRecord }) {
  const snippet = buildSupportSnippet({
    action: incident.surface ?? "Unknown",
    path: incident.surface,
    requestId: incident.requestId,
    code: incident.code ?? undefined,
  });
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{incident.surface}</p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{incident.code ?? "Unknown code"}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{incident.message ?? "No message"}</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">
            {new Date(incident.at).toLocaleString()} · Ref {incident.requestId}
          </p>
          {incident.emailMasked ? (
            <p className="text-[11px] text-[rgb(var(--muted))]">User: {incident.emailMasked}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <CopyIconButton text={snippet} label={OPS_INCIDENTS_COPY.copySnippet} />
          {incident.userId ? (
            <Link
              href={`/app/ops/users/${incident.userId}`}
              className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-1 text-[12px] font-semibold text-white"
            >
              {OPS_INCIDENTS_COPY.openDossier}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const SURFACE_FILTERS: { label: string; value: IncidentSurface | "all" }[] = [
  { label: OPS_INCIDENTS_COPY.filters.surfaceAll, value: "all" },
  { label: "Billing", value: "billing" },
  { label: "Checkout", value: "checkout" },
  { label: "Portal", value: "portal" },
  { label: "Outcomes", value: "outcomes" },
  { label: "Outreach", value: "outreach" },
  { label: "Referrals", value: "referrals" },
];

const TIME_FILTERS = [
  { label: OPS_INCIDENTS_COPY.filters.time24h, value: "1" },
  { label: OPS_INCIDENTS_COPY.filters.time7d, value: "7" },
];

export default async function IncidentConsole({ searchParams }: { searchParams?: { requestId?: string; surface?: string; days?: string } }) {
  const { supabase, user } = await getSupabaseUser();
  if (!user || !isOpsAdmin(user.email)) {
    notFound();
  }

  const requestId = searchParams?.requestId?.trim() ?? "";
  const surfaceFilter = (searchParams?.surface as IncidentSurface | "all" | undefined) ?? "all";
  const days = Number(searchParams?.days ?? "7");

  const recent = await getRecentIncidentEvents({ limit: 20, sinceDays: Number.isFinite(days) ? days : 7 });
  const filteredRecent = recent.filter((inc) => surfaceFilter === "all" || inc.surface === surfaceFilter);
  const detail = requestId ? await getIncidentByRequestId(requestId) : null;

  const path = "/app/ops/incidents";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
          <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">{OPS_INCIDENTS_COPY.title}</h1>
          <p className="text-sm text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.subtitle}</p>
        </div>
      </div>

      <form className="space-y-3 rounded-2xl border border-black/10 bg-white/80 p-4" method="get">
        <label className="text-sm font-semibold text-[rgb(var(--ink))]">
          {OPS_INCIDENTS_COPY.lookupPlaceholder}
          <input
            type="text"
            name="requestId"
            defaultValue={requestId}
            placeholder={OPS_INCIDENTS_COPY.lookupPlaceholder}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white">
            {OPS_INCIDENTS_COPY.lookupButton}
          </button>
          {detail ? <CopyIconButton text={buildSupportSnippet({ action: detail.surface, path, requestId: detail.requestId, code: detail.code ?? undefined })} label={OPS_INCIDENTS_COPY.copySnippet} /> : null}
        </div>
        {requestId && !detail ? <p className="text-sm text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.emptyLookup}</p> : null}
        {detail ? <IncidentCard incident={detail} /> : null}
      </form>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">{OPS_INCIDENTS_COPY.recentTitle}</p>
            <p className="text-xs text-[rgb(var(--muted))]">Last {days || 7} days</p>
          </div>
          <form className="flex flex-wrap items-center gap-2" method="get">
            <input type="hidden" name="requestId" value={requestId} />
            <select
              name="surface"
              defaultValue={surfaceFilter}
              className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs"
            >
              {SURFACE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="days"
              defaultValue={days.toString()}
              className="rounded-xl border border-black/10 bg-white px-3 py-1 text-xs"
            >
              {TIME_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-[rgb(var(--ink))]"
            >
              Apply
            </button>
          </form>
        </div>
        {filteredRecent.length === 0 ? (
          <p className="mt-3 text-sm text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.recentEmpty}</p>
        ) : (
          <div className="mt-3 divide-y divide-black/5">
            {filteredRecent.map((incident) => {
              const snippet = buildSupportSnippet({
                action: incident.surface,
                path,
                requestId: incident.requestId,
                code: incident.code ?? undefined,
              });
              return (
                <div key={`${incident.requestId}-${incident.at}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="space-y-1">
                    <p className="text-xs text-[rgb(var(--muted))]">
                      {new Date(incident.at).toLocaleString()} · {incident.surface}
                    </p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {incident.code ?? "No code"} · {incident.message ?? "No message"}
                    </p>
                    <p className="text-[11px] text-[rgb(var(--muted))]">Ref {incident.requestId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyIconButton text={incident.requestId} label="Copy ref" />
                    <CopyIconButton text={snippet} label={OPS_INCIDENTS_COPY.copySnippet} />
                    <Link
                      href={`/app/ops/incidents?requestId=${encodeURIComponent(incident.requestId)}`}
                      className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
