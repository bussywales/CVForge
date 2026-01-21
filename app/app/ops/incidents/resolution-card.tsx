"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildBillingReply, type BillingResolutionLabel } from "@/lib/ops/ops-billing-reply";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import type { ResolutionOutcome, ResolutionOutcomeCode } from "@/lib/ops/ops-resolution-outcomes";

type Props = {
  incidentRequestId?: string | null;
  userId?: string | null;
  supportLink?: string | null;
  auditsLink?: string | null;
  incidentsLink?: string | null;
  defaultLabel?: BillingResolutionLabel;
  initialOutcomes?: ResolutionOutcome[];
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

const OUTCOME_OPTIONS: { code: ResolutionOutcomeCode; label: string }[] = [
  { code: "PORTAL_RETRY_SUCCESS", label: "Portal retry success" },
  { code: "WEBHOOK_DELAY_WAITED", label: "Webhook delay waited" },
  { code: "CREDITS_RECONCILED_SUPPORT", label: "Credits reconciled (support)" },
  { code: "SUBSCRIPTION_REACTIVATED", label: "Subscription reactivated" },
  { code: "USER_GUIDED_SELF_SERVE", label: "User guided self-serve" },
  { code: "NOT_BILLING_ISSUE", label: "Not a billing issue" },
  { code: "OTHER", label: "Other" },
];

export function ResolutionCard({
  incidentRequestId,
  userId,
  supportLink,
  auditsLink,
  incidentsLink,
  defaultLabel = "unknown",
  initialOutcomes = [],
}: Props) {
  const [label, setLabel] = useState<BillingResolutionLabel>(defaultLabel);
  const [outcomeCode, setOutcomeCode] = useState<ResolutionOutcomeCode>("PORTAL_RETRY_SUCCESS");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ResolutionOutcome[]>(initialOutcomes);
  const [showOutcomes, setShowOutcomes] = useState(false);
  const reply = useMemo(
    () => buildBillingReply({ label, requestId: incidentRequestId, supportPath: supportLink ?? undefined }),
    [label, incidentRequestId, supportLink]
  );
  const supportSnippet = incidentRequestId
    ? buildSupportSnippet({ action: "Billing resolution", path: "/app/billing", requestId: incidentRequestId, code: label })
    : null;
  const [viewLogged, setViewLogged] = useState(false);
  const latestOutcome = outcomes[0];

  useEffect(() => {
    if (viewLogged) return;
    setViewLogged(true);
    logMonetisationClientEvent("ops_resolution_view", null, "ops", { label, requestId: incidentRequestId ?? null });
  }, [viewLogged, label, incidentRequestId]);

  const handleLinkClick = (target: "billing" | "incidents" | "audits") => {
    logMonetisationClientEvent("ops_resolution_link_click", null, "ops", { target, requestId: incidentRequestId ?? null, userId: userId ?? null });
  };

  const saveOutcome = async () => {
    if (saving || (!incidentRequestId && !userId)) return;
    setSaving(true);
    setError(null);
    logMonetisationClientEvent("ops_resolution_outcome_set_click", null, "ops", { code: outcomeCode, hasNote: Boolean(note) });
    try {
      const res = await fetch("/api/ops/resolution-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: outcomeCode,
          note: note ? note.slice(0, 200) : undefined,
          requestId: incidentRequestId ?? undefined,
          userId: userId ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        const reqId = res.headers.get("x-request-id") ?? body?.error?.requestId ?? null;
        setError(body?.error?.message ?? "Unable to save outcome");
        logMonetisationClientEvent("ops_resolution_outcome_set_error", null, "ops", { requestId: reqId });
        return;
      }
      const createdAt = new Date().toISOString();
      const newOutcome: ResolutionOutcome = {
        code: outcomeCode,
        note: note ? note.slice(0, 200) : undefined,
        createdAt,
        actor: null,
        requestId: incidentRequestId ?? null,
        userId: userId ?? null,
      };
      setOutcomes((prev) => [newOutcome, ...prev].slice(0, 3));
      logMonetisationClientEvent("ops_resolution_outcome_set_success", null, "ops", { code: outcomeCode });
      setNote("");
    } catch {
      logMonetisationClientEvent("ops_resolution_outcome_set_error", null, "ops", { code: outcomeCode });
      setError("Unable to save outcome");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3 text-xs shadow-sm" data-testid="resolution-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Ops Resolution</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">
            Select outcome, copy reply, and close the loop.
            {latestOutcome ? (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                Last resolution: {latestOutcome.code}
              </span>
            ) : null}
          </p>
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
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-indigo-900">Mark resolved</p>
            {latestOutcome ? <span className="text-[10px] text-indigo-800">Saved {new Date(latestOutcome.createdAt).toLocaleString()}</span> : null}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <select
              className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
              value={outcomeCode}
              onChange={(e) => setOutcomeCode(e.target.value as ResolutionOutcomeCode)}
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex flex-col">
              <input
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="Optional note (200 char max)"
                className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] text-[rgb(var(--ink))]"
              />
              <span className="self-end text-[10px] text-[rgb(var(--muted))]">{note.length}/200</span>
            </div>
          </div>
          {error ? <p className="mt-1 text-[11px] text-rose-700">Error: {error}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
              onClick={saveOutcome}
              disabled={saving || (!incidentRequestId && !userId)}
            >
              {saving ? "Saving..." : "Save outcome"}
            </button>
            <button
              type="button"
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
              onClick={() => {
                setShowOutcomes((prev) => {
                  const next = !prev;
                  if (next) {
                    logMonetisationClientEvent("ops_resolution_outcomes_view", null, "ops", {
                      hasRequestId: Boolean(incidentRequestId),
                    });
                  }
                  return next;
                });
              }}
            >
              View outcomes
            </button>
          </div>
          {showOutcomes ? (
            <ul className="mt-2 space-y-1">
              {outcomes.length === 0 ? <li className="text-[11px] text-[rgb(var(--muted))]">No outcomes yet.</li> : null}
              {outcomes.map((o, idx) => (
                <li key={`${o.code}-${idx}`} className="rounded-lg border border-indigo-100 bg-white px-2 py-1">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">
                    {o.code} <span className="text-[10px] text-[rgb(var(--muted))]">{new Date(o.createdAt).toLocaleString()}</span>
                  </p>
                  {o.note ? <p className="text-[11px] text-[rgb(var(--muted))]">{o.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
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
