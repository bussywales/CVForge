"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildBillingReply, type BillingResolutionLabel } from "@/lib/ops/ops-billing-reply";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

type Props = {
  incidentRequestId?: string | null;
  userId?: string | null;
  supportLink?: string | null;
  auditsLink?: string | null;
  incidentsLink?: string | null;
  defaultLabel?: BillingResolutionLabel;
};

const LABELS: BillingResolutionLabel[] = [
  "resolved_portal",
  "resolved_checkout",
  "resolved_webhook",
  "resolved_credits_delay",
  "needs_user",
  "escalated",
  "unknown",
];

export function ResolutionCard({ incidentRequestId, userId, supportLink, auditsLink, incidentsLink, defaultLabel = "unknown" }: Props) {
  const [label, setLabel] = useState<BillingResolutionLabel>(defaultLabel);
  const reply = useMemo(() => buildBillingReply({ label, requestId: incidentRequestId, supportPath: supportLink ?? undefined }), [label, incidentRequestId, supportLink]);
  const supportSnippet = incidentRequestId
    ? buildSupportSnippet({ action: "Billing resolution", path: "/app/billing", requestId: incidentRequestId, code: label })
    : null;
  const [viewLogged, setViewLogged] = useState(false);

  useEffect(() => {
    if (viewLogged) return;
    setViewLogged(true);
    logMonetisationClientEvent("ops_resolution_view", null, "ops", { label, requestId: incidentRequestId ?? null });
  }, [viewLogged, label, incidentRequestId]);

  const handleLinkClick = (target: "billing" | "incidents" | "audits") => {
    logMonetisationClientEvent("ops_resolution_link_click", null, "ops", { target, requestId: incidentRequestId ?? null, userId: userId ?? null });
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3 text-xs shadow-sm" data-testid="resolution-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Ops Resolution</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">Select outcome, copy reply, and close the loop.</p>
        </div>
        <select
          className="rounded-full border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
          value={label}
          onChange={(e) => {
            const next = e.target.value as BillingResolutionLabel;
            setLabel(next);
          }}
        >
          {LABELS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Customer reply</p>
          <textarea
            className="mt-1 w-full rounded-lg border border-black/10 p-2 text-xs text-[rgb(var(--ink))]"
            rows={4}
            value={reply.body}
            readOnly
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
              onClick={() => {
                navigator.clipboard.writeText(reply.body).catch(() => undefined);
                logMonetisationClientEvent("ops_resolution_copy_reply", null, "ops", { label, requestId: incidentRequestId ?? null });
              }}
            >
              Copy reply
            </button>
            <button
              type="button"
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
              onClick={() => {
                logMonetisationClientEvent("ops_resolution_regenerate", null, "ops", { label, requestId: incidentRequestId ?? null });
              }}
            >
              Regenerate
            </button>
            <button
              type="button"
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
              onClick={() => {
                logMonetisationClientEvent("ops_resolution_mark_used", null, "ops", { label, requestId: incidentRequestId ?? null });
              }}
            >
              Mark as used
            </button>
            {supportSnippet ? (
              <button
                type="button"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
                onClick={() => {
                  navigator.clipboard.writeText(supportSnippet).catch(() => undefined);
                  logMonetisationClientEvent("ops_resolution_copy_snippet", null, "ops", { requestId: incidentRequestId ?? null });
                }}
              >
                Copy support snippet
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {supportLink ? (
            <Link
              href={supportLink}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => handleLinkClick("billing")}
            >
              Open Billing
            </Link>
          ) : null}
          {incidentsLink ? (
            <Link
              href={incidentsLink}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => handleLinkClick("incidents")}
            >
              Open related incidents
            </Link>
          ) : null}
          {auditsLink ? (
            <Link
              href={auditsLink}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => handleLinkClick("audits")}
            >
              Open audits
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
