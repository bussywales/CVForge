"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildBillingReply, type BillingResolutionLabel } from "@/lib/ops/ops-billing-reply";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import type { EffectivenessState, ResolutionOutcome, ResolutionOutcomeCode } from "@/lib/ops/ops-resolution-outcomes";
import { isOutcomeDue, LATER_WINDOW_MS } from "@/lib/ops/resolution-effectiveness";

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

const EFFECTIVENESS_REASONS: Record<Exclude<EffectivenessState, "unknown">, { value: string; label: string }[]> = {
  success: [
    { value: "unblocked", label: "Customer unblocked" },
    { value: "self_serve_follow_through", label: "User followed playbook" },
    { value: "manual_fix", label: "Manual fix worked" },
  ],
  fail: [
    { value: "still_blocked", label: "Still blocked" },
    { value: "could_not_reach", label: "Could not reach user" },
    { value: "wrong_playbook", label: "Wrong playbook" },
    { value: "other", label: "Other" },
  ],
};

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
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchSaved, setWatchSaved] = useState(false);
  const [effectivenessSelection, setEffectivenessSelection] = useState<EffectivenessState | null>(null);
  const [effectivenessReason, setEffectivenessReason] = useState("");
  const [effectivenessNote, setEffectivenessNote] = useState("");
  const [effectivenessSaving, setEffectivenessSaving] = useState(false);
  const [effectivenessError, setEffectivenessError] = useState<string | null>(null);
  const [effectivenessMessage, setEffectivenessMessage] = useState<string | null>(null);
  const [effectivenessViewLogged, setEffectivenessViewLogged] = useState(false);
  const reply = useMemo(
    () => buildBillingReply({ label, requestId: incidentRequestId, supportPath: supportLink ?? undefined }),
    [label, incidentRequestId, supportLink]
  );
  const supportSnippet = incidentRequestId
    ? buildSupportSnippet({ action: "Billing resolution", path: "/app/billing", requestId: incidentRequestId, code: label })
    : null;
  const [viewLogged, setViewLogged] = useState(false);
  const latestOutcome = outcomes[0];
  const effectivenessRequestId = incidentRequestId ?? latestOutcome?.requestId ?? null;
  const canReviewEffectiveness = Boolean(latestOutcome?.id && isOutcomeDue(latestOutcome));
  const showWatchCta = outcomeCode === "WEBHOOK_DELAY_WAITED" || outcomeCode === "CREDITS_RECONCILED_SUPPORT";

  useEffect(() => {
    if (viewLogged) return;
    setViewLogged(true);
    logMonetisationClientEvent("ops_resolution_view", null, "ops", { label, requestId: incidentRequestId ?? null });
  }, [viewLogged, label, incidentRequestId]);

  useEffect(() => {
    if (!latestOutcome || !canReviewEffectiveness || effectivenessViewLogged) return;
    logMonetisationClientEvent("ops_resolution_effectiveness_view", null, "ops", {
      requestId: effectivenessRequestId,
      outcomeCode: latestOutcome.code,
    });
    setEffectivenessViewLogged(true);
  }, [canReviewEffectiveness, effectivenessRequestId, effectivenessViewLogged, latestOutcome]);

  useEffect(() => {
    setEffectivenessSelection(null);
    setEffectivenessReason("");
    setEffectivenessNote("");
    setEffectivenessMessage(null);
    setEffectivenessError(null);
    setEffectivenessViewLogged(false);
  }, [latestOutcome?.id]);

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
      const saved = body?.item as any;
      const newOutcome: ResolutionOutcome = {
        id: saved?.id ?? undefined,
        code: (saved?.code as ResolutionOutcomeCode) ?? outcomeCode,
        note: note ? note.slice(0, 200) : undefined,
        createdAt: saved?.createdAt ?? createdAt,
        actor: saved?.actorMasked ?? null,
        requestId: saved?.requestId ?? incidentRequestId ?? null,
        userId: saved?.userId ?? userId ?? null,
        effectivenessState: saved?.effectivenessState ?? "unknown",
        effectivenessReason: saved?.effectivenessReason ?? null,
        effectivenessNote: saved?.effectivenessNote ?? null,
        effectivenessUpdatedAt: saved?.effectivenessUpdatedAt ?? createdAt,
        effectivenessDeferredUntil: saved?.effectivenessDeferredUntil ?? null,
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

  const addWatch = async () => {
    if (watchSaving || (!incidentRequestId && !userId)) return;
    setWatchSaving(true);
    setWatchSaved(false);
    setError(null);
    logMonetisationClientEvent("ops_watch_add_click", null, "ops", { code: outcomeCode });
    try {
      const res = await fetch("/api/ops/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: incidentRequestId,
          userId,
          reasonCode: outcomeCode,
          ttlHours: 24,
          note: note ? note.slice(0, 120) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        const reqId = res.headers.get("x-request-id") ?? body?.error?.requestId ?? null;
        logMonetisationClientEvent("ops_watch_add_error", null, "ops", { requestId: reqId });
        setError(body?.error?.message ?? "Unable to add watch");
        return;
      }
      logMonetisationClientEvent("ops_watch_add_success", null, "ops", { reasonCode: outcomeCode });
      setWatchSaved(true);
    } catch {
      logMonetisationClientEvent("ops_watch_add_error", null, "ops", { code: outcomeCode });
      setError("Unable to add watch");
    } finally {
      setWatchSaving(false);
    }
  };

  const saveEffectiveness = async (stateOverride?: EffectivenessState, reasonOverride?: string | null) => {
    if (effectivenessSaving) return;
    const target = stateOverride ?? effectivenessSelection;
    const targetOutcome = outcomes[0];
    if (!target || !targetOutcome?.id) return;
    setEffectivenessSaving(true);
    setEffectivenessError(null);
    setEffectivenessMessage(null);
    const reason = reasonOverride ?? (effectivenessReason || undefined);
    const notePayload = target === "unknown" ? undefined : effectivenessNote ? effectivenessNote.slice(0, 200) : undefined;
    try {
      const res = await fetch("/api/ops/resolution-effectiveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionOutcomeId: targetOutcome.id,
          state: target,
          reason,
          note: notePayload,
          source: "resolution_card",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        const reqId = res.headers.get("x-request-id") ?? body?.error?.requestId ?? null;
        setEffectivenessError(body?.error?.message ?? "Unable to save follow-up");
        logMonetisationClientEvent("ops_resolution_effectiveness_save_error", null, "ops", {
          requestId: reqId,
          outcomeCode: targetOutcome.code,
          state: target,
        });
        return;
      }
      const updated: ResolutionOutcome = {
        ...targetOutcome,
        effectivenessState: target,
        effectivenessReason: reason ?? null,
        effectivenessNote: notePayload ?? null,
        effectivenessSource: "resolution_card",
        effectivenessUpdatedAt: body?.item?.effectivenessUpdatedAt ?? new Date().toISOString(),
        effectivenessDeferredUntil:
          target === "unknown" && reasonOverride === "later"
            ? new Date(Date.now() + LATER_WINDOW_MS).toISOString()
            : body?.item?.effectivenessDeferredUntil ?? targetOutcome.effectivenessDeferredUntil ?? null,
      };
      setOutcomes((prev) => prev.map((o, idx) => (idx === 0 || o.id === updated.id ? { ...o, ...updated } : o)));
      const responseRequestId = body?.requestId ?? res.headers.get("x-request-id") ?? null;
      const successMessage = target === "unknown" && reasonOverride === "later" ? "Snoozed for 24h." : "Saved follow-up.";
      setEffectivenessMessage(responseRequestId ? `${successMessage} (req ${responseRequestId})` : successMessage);
      setEffectivenessSelection(null);
      setEffectivenessReason("");
      setEffectivenessNote("");
      logMonetisationClientEvent("ops_resolution_effectiveness_save_success", null, "ops", {
        requestId: effectivenessRequestId,
        outcomeCode: targetOutcome.code,
        state: target,
        reason: reason ?? null,
      });
    } catch {
      setEffectivenessError("Unable to save follow-up");
      logMonetisationClientEvent("ops_resolution_effectiveness_save_error", null, "ops", {
        outcomeCode: targetOutcome?.code ?? null,
        state: target,
      });
    } finally {
      setEffectivenessSaving(false);
    }
  };

  const handleEffectivenessChoice = (state: EffectivenessState) => {
    if (!latestOutcome?.id) return;
    setEffectivenessMessage(null);
    setEffectivenessError(null);
    const event =
      state === "success"
        ? "ops_resolution_effectiveness_yes_click"
        : state === "fail"
          ? "ops_resolution_effectiveness_no_click"
          : "ops_resolution_effectiveness_later_click";
    logMonetisationClientEvent(event, null, "ops", {
      requestId: effectivenessRequestId,
      outcomeCode: latestOutcome.code,
    });
    if (state === "unknown") {
      void saveEffectiveness("unknown", "later");
      return;
    }
    setEffectivenessReason("");
    setEffectivenessNote("");
    setEffectivenessSelection(state);
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
            {showWatchCta ? (
              <button
                type="button"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                onClick={addWatch}
                disabled={watchSaving || (!incidentRequestId && !userId)}
              >
                {watchSaving ? "Adding..." : watchSaved ? "Watch added" : "Add to watchlist"}
              </button>
            ) : null}
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
        {canReviewEffectiveness ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-amber-900">Did it work?</p>
              <span className="text-[10px] text-amber-800">{latestOutcome?.code}</span>
            </div>
            {effectivenessMessage ? <p className="text-[11px] text-emerald-700">{effectivenessMessage}</p> : null}
            {effectivenessError ? <p className="text-[11px] text-rose-700">Error: {effectivenessError}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                onClick={() => handleEffectivenessChoice("success")}
                disabled={effectivenessSaving}
              >
                Yes
              </button>
              <button
                type="button"
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                onClick={() => handleEffectivenessChoice("fail")}
                disabled={effectivenessSaving}
              >
                No
              </button>
              <button
                type="button"
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                onClick={() => handleEffectivenessChoice("unknown")}
                disabled={effectivenessSaving}
              >
                Later
              </button>
              <span className="text-[10px] text-[rgb(var(--muted))]">Later hides for 24h.</span>
            </div>
            {effectivenessSelection && effectivenessSelection !== "unknown" ? (
              <div className="mt-2 space-y-2">
                <select
                  className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  value={effectivenessReason}
                  onChange={(e) => setEffectivenessReason(e.target.value)}
                >
                  <option value="">Reason (optional)</option>
                  {EFFECTIVENESS_REASONS[effectivenessSelection].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={effectivenessNote}
                  onChange={(e) => setEffectivenessNote(e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={3}
                  placeholder="Optional note"
                  className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] text-[rgb(var(--ink))]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-amber-200 bg-amber-800 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    onClick={() => saveEffectiveness()}
                    disabled={effectivenessSaving}
                  >
                    {effectivenessSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                    onClick={() => {
                      setEffectivenessSelection(null);
                      setEffectivenessReason("");
                      setEffectivenessNote("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
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
