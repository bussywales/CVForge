"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import CopyIconButton from "@/components/CopyIconButton";
import { OPS_INCIDENTS_COPY } from "@/lib/ops/incidents.microcopy";
import {
  type IncidentRecord,
  type IncidentGroup,
  groupIncidents,
  correlateIncidents,
  buildAuditsLink,
  buildIncidentsLink,
} from "@/lib/ops/incidents-shared";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import { filterIncidents } from "@/lib/ops/incidents-filters";
import { buildSupportBundleFromIncident } from "@/lib/ops/support-bundle";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { detectPortalSpike } from "@/lib/ops/portal-spike";
import { buildIncidentPlaybook, type IncidentPlaybook } from "@/lib/ops/ops-incident-playbooks";
import { buildOpsBillingHealth } from "@/lib/ops/ops-billing-health";
import { buildBillingTraceSummary } from "@/lib/ops/ops-billing-trace";
import { buildBillingDelayBuckets } from "@/lib/ops/ops-billing-delay-buckets";
import { ResolutionCard } from "./resolution-card";
import { buildOpsWebhookHealth } from "@/lib/ops/ops-webhook-health";
import { shouldSuppressPlaybook } from "@/lib/ops/playbook-suppression";
import type { ResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";
import type { WatchRecord } from "@/lib/ops/ops-watch";

type Props = {
  incidents: IncidentRecord[];
  initialLookup?: IncidentRecord | null;
  initialRequestId?: string | null;
  initialOutcomes?: ResolutionOutcome[];
  initialWatch?: WatchRecord[];
  initialTime?: TimeFilter;
};

type TimeFilter = "0.25" | "1" | "24" | "168";

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

export default function IncidentsClient({ incidents, initialLookup, initialRequestId, initialOutcomes, initialWatch, initialTime }: Props) {
  const [filters, setFilters] = useState({
    time: (initialTime ?? "24") as TimeFilter,
    surface: "all",
    code: "",
    flow: "",
    search: "",
    highImpact: false,
    requestId: initialRequestId ?? "",
  });
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<IncidentRecord | null>(initialLookup ?? null);
  const [playbookLinks, setPlaybookLinks] = useState<Record<string, { url: string; requestId?: string | null }>>({});
  const [playbookErrors, setPlaybookErrors] = useState<Record<string, { message?: string | null; requestId?: string | null } | null>>({});
  const [playbookLoadingKey, setPlaybookLoadingKey] = useState<string | null>(null);
  const [playbookViewed, setPlaybookViewed] = useState<Record<string, boolean>>({});
  const suppressionLogged = useRef<Record<string, boolean>>({});
  const billingSurfaces = useMemo(() => ["billing", "portal", "checkout", "diagnostics"], []);
  const [outcomes] = useState<ResolutionOutcome[]>(initialOutcomes ?? []);
  const [watchRecords] = useState<WatchRecord[]>(initialWatch ?? []);

  const filtered = useMemo(() => filterIncidents(incidents, filters), [incidents, filters]);
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
  const portalSpike = useMemo(() => detectPortalSpike(filtered), [filtered]);
  const billingHealth = useMemo(() => buildOpsBillingHealth(incidents), [incidents]);
  const hasBillingHealth =
    billingHealth.topCodes.length > 0 ||
    billingHealth.window24h.portalErrors > 0 ||
    billingHealth.window24h.checkoutErrors > 0 ||
    billingHealth.window24h.webhookErrors > 0 ||
    billingHealth.window7d.portalErrors > 0 ||
    billingHealth.window7d.checkoutErrors > 0 ||
    billingHealth.window7d.webhookErrors > 0;
  const billingTrace = useMemo(() => buildBillingTraceSummary(incidents), [incidents]);
  const webhookHealth = useMemo(() => buildOpsWebhookHealth(incidents), [incidents]);
  const hasWebhookHealth =
    webhookHealth.topCodes.length > 0 || webhookHealth.counts24h.ok + webhookHealth.counts24h.error + webhookHealth.counts7d.ok + webhookHealth.counts7d.error > 0;
  const webhookFailures = useMemo(
    () =>
      incidents.filter((i) => {
        const code = (i.code ?? "").toLowerCase();
        const eventName = (i.eventName ?? "").toLowerCase();
        return code.includes("webhook_error") || code.includes("webhook_fail") || eventName.includes("webhook_error") || eventName.includes("webhook_fail");
      }),
    [incidents]
  );
  const webhookTopCodes = useMemo(() => {
    const counts = webhookFailures.reduce((map, inc) => {
      const code = inc.code ?? "unknown";
      map.set(code, (map.get(code) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count }))
      .slice(0, 3);
  }, [webhookFailures]);
  const hasWebhookFailures = webhookFailures.length > 0;
  const delayBuckets = useMemo(() => buildBillingDelayBuckets(incidents), [incidents]);
  const hasDelayBuckets =
    delayBuckets.window24h.waiting_ledger + delayBuckets.window24h.waiting_webhook + delayBuckets.window24h.ui_stale + delayBuckets.window24h.unknown > 0 ||
    delayBuckets.window7d.waiting_ledger + delayBuckets.window7d.waiting_webhook + delayBuckets.window7d.ui_stale + delayBuckets.window7d.unknown > 0;
  const billingIncidents = useMemo(
    () => filtered.filter((i) => billingSurfaces.includes(i.surface) || (i.code ?? "").includes("billing") || (i.code ?? "").includes("checkout")),
    [billingSurfaces, filtered]
  );
  const primaryBillingIncident = useMemo(() => {
    if (filters.requestId) {
      const match = filtered.find((i) => i.requestId === filters.requestId);
      if (match) return match;
    }
    if (selected && (billingSurfaces.includes(selected.surface) || (selected.code ?? "").includes("billing") || (selected.code ?? "").includes("checkout"))) return selected;
    return billingIncidents[0] ?? null;
  }, [billingIncidents, billingSurfaces, filtered, filters.requestId, selected]);
  const showResolutionCard = Boolean(filters.requestId || primaryBillingIncident);
  const resolutionRequestId = filters.requestId || primaryBillingIncident?.requestId || null;
  const resolutionUserId = primaryBillingIncident?.userId ?? null;
  const resolutionSupportLink = "/app/billing?from=ops_support&support=1&focus=billing_trace";
  const resolutionIncidentsLink = resolutionRequestId ? buildIncidentsLink(resolutionRequestId) : "/app/ops/incidents?surface=billing&range=24h";
  const resolutionAuditsLink = resolutionRequestId ? buildAuditsLink(resolutionRequestId) : null;
  const resolutionDefaultLabel = useMemo(() => {
    const surface = primaryBillingIncident?.surface;
    if (surface === "portal") return "resolved_portal";
    if (surface === "checkout") return "resolved_checkout";
    if ((primaryBillingIncident?.code ?? "").includes("webhook")) return "resolved_webhook";
    if (surface === "billing") return "resolved_credits_delay";
    return "unknown";
  }, [primaryBillingIncident]);

  useEffect(() => {
    if (filters.requestId) {
      logMonetisationClientEvent("ops_incidents_requestid_filter_applied", null, "ops");
    }
  }, [filters.requestId]);

  useEffect(() => {
    if (hasBillingHealth) {
      logMonetisationClientEvent("ops_billing_health_view", null, "ops");
    }
  }, [hasBillingHealth]);

  useEffect(() => {
    if (incidents.length > 0) {
      logMonetisationClientEvent("ops_billing_trace_view", null, "ops");
    }
  }, [incidents.length]);

  useEffect(() => {
    if (hasWebhookHealth) {
      logMonetisationClientEvent("ops_webhook_health_view", null, "ops", { status: webhookHealth.status });
    }
  }, [hasWebhookHealth, webhookHealth.status]);

  useEffect(() => {
    if (hasDelayBuckets) {
      logMonetisationClientEvent("ops_billing_delay_bucket_view", null, "ops", {
        waiting_webhook: delayBuckets.window24h.waiting_webhook,
        waiting_ledger: delayBuckets.window24h.waiting_ledger,
        ui_stale: delayBuckets.window24h.ui_stale,
        unknown: delayBuckets.window24h.unknown,
      });
    }
  }, [hasDelayBuckets, delayBuckets.window24h.waiting_webhook, delayBuckets.window24h.waiting_ledger, delayBuckets.window24h.ui_stale, delayBuckets.window24h.unknown]);

  useEffect(() => {
    if (watchRecords.length > 0) {
      logMonetisationClientEvent("ops_watchlist_view", null, "ops", { count: watchRecords.length });
    }
  }, [watchRecords.length]);

  useEffect(() => {
    if (!expandedGroup) return;
    const group = groups.find((g) => g.key === expandedGroup);
    if (!group) return;
    const playbook = buildIncidentPlaybook(group);
    if (playbook && !playbookViewed[`${playbook.id}|${group.key}`]) {
      logMonetisationClientEvent("ops_playbook_view", null, "ops", {
        playbookId: playbook.id,
        surface: group.surface,
        code: group.code,
      });
      setPlaybookViewed((prev) => ({ ...prev, [`${playbook.id}|${group.key}`]: true }));
    }
  }, [expandedGroup, groups, playbookViewed]);

  const handleExport = (type: "csv" | "json") => {
    if (groups.length > 500) {
      alert(OPS_INCIDENTS_COPY.exportLimit);
      return;
    }
    if (type === "csv") {
      const csv = ["# masked export", exportCsv(groups)].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "incidents.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const payload = {
        masked: true,
        note: "masked export",
        groups: groups.map((g) => ({
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
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "incidents.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePlaybookAction = async (action: IncidentPlaybook["actions"][number], playbook: IncidentPlaybook, group: IncidentGroup) => {
    logMonetisationClientEvent("ops_playbook_action_click", null, "ops", { playbookId: playbook.id, actionId: action.id });
    if (action.kind === "link") {
      if (action.href) window.open(action.href, "_blank");
      return;
    }
    if (action.kind === "copy") {
      if (action.copyText) {
        try {
          await navigator.clipboard.writeText(action.copyText);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (action.kind === "support-link") {
      if (!action.supportPayload?.userId) {
        setPlaybookErrors((prev) => ({ ...prev, [group.key]: { message: "User required to generate support link" } }));
        return;
      }
      setPlaybookLoadingKey(group.key);
      setPlaybookErrors((prev) => ({ ...prev, [group.key]: null }));
      logMonetisationClientEvent("ops_support_link_from_playbook", action.supportPayload.userId, "ops", {
        playbookId: playbook.id,
        actionId: action.id,
        plan: action.supportPayload.plan,
        pack: action.supportPayload.pack,
      });
      try {
        const res = await fetch("/api/ops/support-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.supportPayload),
        });
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        const reqId = res.headers.get("x-request-id") ?? data?.error?.requestId ?? null;
        if (!res.ok || !data?.url) {
          setPlaybookErrors((prev) => ({
            ...prev,
            [group.key]: { message: data?.error?.message ?? "Unable to generate support link", requestId: reqId },
          }));
          setPlaybookLoadingKey(null);
          return;
        }
        setPlaybookLinks((prev) => ({ ...prev, [group.key]: { url: data.url as string, requestId: reqId } }));
        try {
          await navigator.clipboard.writeText(data.url as string);
        } catch {
          /* ignore */
        }
      } catch (err) {
        setPlaybookErrors((prev) => ({
          ...prev,
          [group.key]: { message: err instanceof Error ? err.message : "Support link failed" },
        }));
      } finally {
        setPlaybookLoadingKey(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      {hasWebhookFailures ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Webhook failures</p>
              <p className="text-[11px] text-[rgb(var(--muted))]">
                {webhookFailures.length} failures in range • top codes:
                {webhookTopCodes.map((c) => (
                  <button
                    key={c.code}
                    className="ml-2 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, code: c.code, time: "24" }));
                      logMonetisationClientEvent("ops_webhook_health_chip_click", null, "ops", { code: c.code });
                    }}
                  >
                    {c.code} ({c.count})
                  </button>
                ))}
              </p>
            </div>
            <Link
              href="/app/ops/webhooks?since=24h"
              className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => logMonetisationClientEvent("ops_webhooks_queue_view", null, "ops", { from: "incidents", range: "24h" })}
            >
              View webhook failures
            </Link>
          </div>
        </div>
      ) : null}
      {hasBillingHealth ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Billing health</p>
              <p className="text-[11px] text-[rgb(var(--muted))]">
                Last 24h: portal {billingHealth.window24h.portalErrors}, checkout {billingHealth.window24h.checkoutErrors}, webhook{" "}
                {billingHealth.window24h.webhookErrors}. Last 7d: portal {billingHealth.window7d.portalErrors}, checkout{" "}
                {billingHealth.window7d.checkoutErrors}, webhook {billingHealth.window7d.webhookErrors}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-semibold text-indigo-800"
                onClick={() => {
                  setFilters((f) => ({ ...f, surface: "portal", time: "24" }));
                  logMonetisationClientEvent("ops_billing_health_chip_click", null, "ops", { kind: "portal_error", window: "24h" });
                }}
              >
                Portal (24h)
              </button>
              <button
                type="button"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-semibold text-indigo-800"
                onClick={() => {
                  setFilters((f) => ({ ...f, surface: "checkout", time: "24" }));
                  logMonetisationClientEvent("ops_billing_health_chip_click", null, "ops", { kind: "checkout_error", window: "24h" });
                }}
              >
                Checkout (24h)
              </button>
              <button
                type="button"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-semibold text-indigo-800"
                onClick={() => {
                  setFilters((f) => ({ ...f, surface: "billing", time: "24", code: "webhook" }));
                  logMonetisationClientEvent("ops_billing_health_chip_click", null, "ops", { kind: "webhook_error", window: "24h" });
                }}
              >
                Webhook (24h)
              </button>
              {billingHealth.topCodes.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-semibold text-indigo-800"
                  onClick={() => {
                    setFilters((f) => ({ ...f, code: entry.code, surface: "billing", time: "24" }));
                    logMonetisationClientEvent("ops_billing_health_chip_click", null, "ops", {
                      kind: "code",
                      code: entry.code,
                    });
                  }}
                >
                  Top code: {entry.code} ({entry.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {hasWebhookHealth ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Webhook health</p>
              <p className="text-[11px] text-[rgb(var(--muted))]">
                Status: {webhookHealth.status} · 24h ok {webhookHealth.counts24h.ok} / errors {webhookHealth.counts24h.error} · 7d ok{" "}
                {webhookHealth.counts7d.ok} / errors {webhookHealth.counts7d.error}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-sky-200 bg-white px-3 py-1 font-semibold text-sky-800"
                onClick={() => {
                  setFilters((f) => ({ ...f, surface: "webhook", time: "24" }));
                  logMonetisationClientEvent("ops_webhook_health_chip_click", null, "ops", { window: "24h" });
                }}
              >
                Webhook (24h)
              </button>
              <button
                type="button"
                className="rounded-full border border-sky-200 bg-white px-3 py-1 font-semibold text-sky-800"
                onClick={() => {
                  setFilters((f) => ({ ...f, surface: "webhook", time: "168" }));
                  logMonetisationClientEvent("ops_webhook_health_chip_click", null, "ops", { window: "7d" });
                }}
              >
                Webhook (7d)
              </button>
              {webhookHealth.topCodes.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  className="rounded-full border border-sky-200 bg-white px-3 py-1 font-semibold text-sky-800"
                  onClick={() => {
                    setFilters((f) => ({ ...f, code: entry.code, surface: "webhook", time: "24" }));
                    logMonetisationClientEvent("ops_webhook_health_chip_click", null, "ops", { window: "24h", code: entry.code });
                  }}
                >
                  Code: {entry.code} ({entry.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {hasDelayBuckets ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Delay buckets (24h)</p>
              <p className="text-[11px] text-[rgb(var(--muted))]">
                waiting_webhook {delayBuckets.window24h.waiting_webhook} · waiting_ledger {delayBuckets.window24h.waiting_ledger} · ui_stale{" "}
                {delayBuckets.window24h.ui_stale} · unknown {delayBuckets.window24h.unknown}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(delayBuckets.window24h).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 font-semibold text-amber-800"
                  onClick={() => {
                    setFilters((f) => ({ ...f, surface: "billing", code: key, time: "24" }));
                    logMonetisationClientEvent("ops_billing_delay_chip_click", null, "ops", { bucket: key, window: "24h" });
                  }}
                >
                  {key} ({val})
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {watchRecords.length > 0 ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Watchlist</p>
            <span className="text-[10px] text-[rgb(var(--muted))]">{watchRecords.length} active</span>
          </div>
          <ul className="mt-2 space-y-1">
            {watchRecords
              .slice()
              .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
              .slice(0, 10)
              .map((w) => (
                <li key={`${w.requestId}-${w.expiresAt}`} className="rounded-lg border border-indigo-100 bg-white px-2 py-1">
                  <p className="font-semibold text-[rgb(var(--ink))]">
                    {w.reasonCode} · {w.requestId}
                  </p>
                  <p className="text-[10px] text-[rgb(var(--muted))]">Expires {new Date(w.expiresAt).toLocaleString()}</p>
                  {w.note ? <p className="text-[11px] text-[rgb(var(--muted))]">{w.note}</p> : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {showResolutionCard ? (
        <ResolutionCard
          incidentRequestId={resolutionRequestId ?? undefined}
          userId={resolutionUserId ?? undefined}
          supportLink={resolutionSupportLink}
          incidentsLink={resolutionIncidentsLink}
          auditsLink={resolutionAuditsLink}
          defaultLabel={resolutionDefaultLabel}
          initialOutcomes={initialOutcomes}
        />
      ) : null}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Webhook & credits trace</p>
            <p className="text-[11px] text-[rgb(var(--muted))]">
              {billingTrace.coverage.label} · 24h checkout success {billingTrace.window24h.checkoutSuccess}, webhook {billingTrace.window24h.webhookReceived}, errors {billingTrace.window24h.webhookError}, delays {billingTrace.window24h.delayedCredit}.
            </p>
            <p className="text-[11px] text-[rgb(var(--muted))]">
              7d: checkout {billingTrace.window7d.checkoutSuccess}, webhook {billingTrace.window7d.webhookReceived}, errors {billingTrace.window7d.webhookError}, delays {billingTrace.window7d.delayedCredit}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 font-semibold text-emerald-800"
              onClick={() => {
                setFilters((f) => ({ ...f, time: "24", surface: "checkout" }));
                logMonetisationClientEvent("ops_billing_trace_chip_click", null, "ops", { kind: "checkout", window: "24h" });
              }}
            >
              Checkout (24h)
            </button>
            <button
              type="button"
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 font-semibold text-emerald-800"
              onClick={() => {
                setFilters((f) => ({ ...f, time: "24", surface: "billing", code: "webhook" }));
                logMonetisationClientEvent("ops_billing_trace_chip_click", null, "ops", { kind: "webhook", window: "24h" });
              }}
            >
              Webhook (24h)
            </button>
            <button
              type="button"
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 font-semibold text-emerald-800"
              onClick={() => {
                setFilters((f) => ({ ...f, time: "168", surface: "billing" }));
                logMonetisationClientEvent("ops_billing_trace_chip_click", null, "ops", { kind: "delayed", window: "7d" });
              }}
            >
              7d view
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs">
        <div className="flex items-center gap-2">
          <label>
            {OPS_INCIDENTS_COPY.filters.timeLabel}
            <select
              className="ml-1 rounded-md border border-black/10 px-2 py-1"
              value={filters.time}
              onChange={(e) => setFilters((f) => ({ ...f, time: e.target.value as TimeFilter }))}
            >
              <option value="0.25">{OPS_INCIDENTS_COPY.filters.time15m}</option>
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
            placeholder="Request ID"
            value={filters.requestId}
            onChange={(e) => setFilters((f) => ({ ...f, requestId: e.target.value }))}
            className="w-48 rounded-md border border-black/10 px-3 py-1"
          />
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
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[rgb(var(--muted))]">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2 py-1 font-semibold"
            onClick={() => setFilters((f) => ({ ...f, time: "24" }))}
          >
            Last 24h
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2 py-1 font-semibold"
            onClick={() => setFilters((f) => ({ ...f, highImpact: true, surface: "billing" }))}
          >
            High impact
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2 py-1 font-semibold"
            onClick={() => setFilters((f) => ({ ...f, surface: "billing" }))}
          >
            Billing
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2 py-1 font-semibold"
            onClick={() => setFilters((f) => ({ ...f, surface: "other" }))}
          >
            Ops actions
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-2 py-1 font-semibold"
            onClick={() => setFilters((f) => ({ ...f, search: "user", requestId: f.requestId }))}
          >
            User-reported
          </button>
        </div>
      </div>

      {filters.requestId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          <span>Filtered by requestId {filters.requestId}</span>
          <CopyIconButton text={filters.requestId} label="Copy ref" />
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() => {
              logMonetisationClientEvent("ops_incidents_open_audits_click", null, "ops");
              window.open(buildAuditsLink(filters.requestId), "_blank");
            }}
          >
            View audits
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {portalSpike.spike ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-amber-900">Stripe portal failures detected</p>
                <p className="text-[11px] text-amber-800">
                  {portalSpike.total} portal errors in this window. Top codes:{" "}
                  {portalSpike.codes.slice(0, 2).map((c) => `${c.code} (${c.count})`).join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/app/ops/audits?action=billing_portal_error"
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800 underline-offset-2 hover:underline"
                >
                  View audits
                </Link>
                {filters.requestId ? (
                  <button
                    type="button"
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800"
                    onClick={() => setFilters((f) => ({ ...f, requestId: "" }))}
                  >
                    Clear request filter
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {groups.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted))]">{OPS_INCIDENTS_COPY.groupEmpty}</p>
        ) : (
          groups.map((group) => {
            const expanded = expandedGroup === group.key;
            const groupUserId = group.incidents.find((inc) => inc.userId)?.userId ?? null;
            const isBillingGroup =
              group.surface === "billing" ||
              group.surface === "portal" ||
              group.surface === "checkout" ||
              (group.code ?? "").toLowerCase().includes("portal") ||
              (group.code ?? "").toLowerCase().includes("checkout") ||
              (group.flow ?? "").toLowerCase().includes("portal") ||
              (group.flow ?? "").toLowerCase().includes("billing");
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
                    {isBillingGroup && groupUserId ? (
                      <Link
                        href={`/app/ops/users/${groupUserId}#billing-triage`}
                        className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                      >
                        Open user billing triage
                      </Link>
                    ) : null}
                  </div>
                </div>
                {expanded ? (
                  <div className="mt-3 space-y-2">
                    {group.sampleRequestIds[0] ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] text-blue-800">
                        <span>Primary ref {group.sampleRequestIds[0]}</span>
                        <CopyIconButton text={group.sampleRequestIds[0]} label="Copy" />
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline"
                          onClick={() => {
                            logMonetisationClientEvent("ops_incidents_open_audits_click", null, "ops");
                            window.open(buildAuditsLink(group.sampleRequestIds[0]), "_blank");
                          }}
                        >
                          View audits
                        </button>
                      </div>
                    ) : null}
                    {(() => {
                      const playbook = buildIncidentPlaybook(group);
                      const suppression = shouldSuppressPlaybook({ group, outcomes });
                      const linkState = playbookLinks[group.key];
                      const errorState = playbookErrors[group.key];
                      const requestIdForLog = group.sampleRequestIds[0] ?? null;
                      if (suppression.suppressed) {
                        const logKey = `${group.key}-suppressed`;
                        if (!suppressionLogged.current[logKey]) {
                          logMonetisationClientEvent("ops_playbook_suppressed_view", null, "ops", {
                            requestId: requestIdForLog,
                          });
                          logMonetisationClientEvent("ops_billing_playbook_suppressed_success", null, "ops", {
                            requestId: requestIdForLog,
                            outcomeCode: suppression.outcome?.code ?? null,
                            state: suppression.outcome?.effectivenessState ?? null,
                          });
                          suppressionLogged.current[logKey] = true;
                        }
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-[rgb(var(--muted))]">
                            Resolved recently: {suppression.outcome?.code ?? "outcome"} at {suppression.outcome?.createdAt}
                          </div>
                        );
                      }
                      if (!playbook) {
                        return (
                          <div className="rounded-lg border border-black/5 bg-white px-3 py-2 text-[11px] text-[rgb(var(--muted))]">
                            No playbook yet — use requestId lookup and audits timeline.
                          </div>
                        );
                      }
                      const showFailedHint = Boolean(suppression.failed && suppression.outcome);
                      if (showFailedHint) {
                        const logKey = `${group.key}-failed`;
                        if (!suppressionLogged.current[logKey]) {
                          logMonetisationClientEvent("ops_billing_playbook_unsuppressed_failed", null, "ops", {
                            requestId: requestIdForLog,
                            outcomeCode: suppression.outcome?.code ?? null,
                            state: suppression.outcome?.effectivenessState ?? null,
                          });
                          suppressionLogged.current[logKey] = true;
                        }
                      }
                      return (
                        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                          {showFailedHint && suppression.outcome ? (
                            <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                              Previous attempt failed ({suppression.outcome.code}). Try again with the playbook.
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">{playbook.severityHint.toUpperCase()} impact</p>
                              <p className="text-sm font-semibold text-[rgb(var(--ink))]">{playbook.title}</p>
                              <p className="text-[rgb(var(--muted))]">{playbook.summary}</p>
                            </div>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div>
                              <p className="font-semibold text-[rgb(var(--ink))]">Likely causes</p>
                              <ul className="list-disc pl-4 text-[rgb(var(--muted))]">
                                {playbook.likelyCauses.map((cause) => (
                                  <li key={cause}>{cause}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold text-[rgb(var(--ink))]">Next steps</p>
                              <ul className="list-disc pl-4 text-[rgb(var(--muted))]">
                                {playbook.nextSteps.map((step) => (
                                  <li key={step.label}>
                                    <span className="font-semibold text-[rgb(var(--ink))]">{step.label}</span>
                                    {step.detail ? <span className="text-[rgb(var(--muted))]"> — {step.detail}</span> : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {playbook.actions.map((action) => {
                              const disabled =
                                (action.kind === "link" && !action.href) ||
                                (action.kind === "support-link" && (!action.supportPayload?.userId || playbookLoadingKey === group.key));
                              return (
                                <button
                                  key={action.id}
                                  type="button"
                                  className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() => handlePlaybookAction(action, playbook, group)}
                                  disabled={disabled}
                                >
                                  {playbookLoadingKey === group.key && action.kind === "support-link" ? "Generating..." : action.label}
                                </button>
                              );
                            })}
                          </div>
                          {linkState ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] text-[rgb(var(--muted))]">
                              <span className="font-semibold text-[rgb(var(--ink))]">Support link</span>
                              <a href={linkState.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                                {linkState.url}
                              </a>
                              <CopyIconButton text={linkState.url} label="Copy" />
                              {linkState.requestId ? <span>ref {linkState.requestId}</span> : null}
                            </div>
                          ) : null}
                          {errorState ? (
                            <div className="rounded-lg border border-red-100 bg-white px-2 py-1 text-[10px] text-red-700">
                              <p>{errorState.message ?? "Support link failed"}</p>
                              {errorState.requestId ? <p>ref {errorState.requestId}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
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
                      const bundle = buildSupportBundleFromIncident(inc);
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
                          <div
                            className="mt-2 space-y-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800"
                            onClick={() => logMonetisationClientEvent("ops_support_bundle_view", null, "ops")}
                          >
                            <p className="font-semibold text-[rgb(var(--ink))]">{bundle.title}</p>
                            <p className="text-[rgb(var(--muted))]">{bundle.summary}</p>
                            <p className="text-[rgb(var(--muted))]">Next: {bundle.nextAction}</p>
                            <div className="flex flex-wrap gap-1">
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
                            {inc.userId ? (
                              <Link
                                href={`/app/ops/users/${inc.userId}`}
                                className="text-blue-700 underline-offset-2 hover:underline"
                              >
                                Open dossier
                              </Link>
                            ) : null}
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
