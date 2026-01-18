"use client";

import { useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { OUTCOME_STATUSES } from "@/lib/outcome-loop";
import { OUTCOME_COPY } from "@/lib/microcopy/outcomes";

type OutcomeQuickLogProps = {
  applicationId: string;
  defaultStatus?: string | null;
  onSaved?: (payload: { status: string; reason?: string | null; notes?: string | null }) => void;
};

const REASONS: Record<string, string[]> = {
  rejected: ["skills_gap", "timing", "salary_mismatch", "internal_candidate", "other"],
  no_response: ["timing", "other"],
  withdrew: ["timing", "other"],
  offer: ["salary_mismatch", "timing", "other"],
};

export default function OutcomeQuickLog({ applicationId, defaultStatus, onSaved }: OutcomeQuickLogProps) {
  const [status, setStatus] = useState<string>(defaultStatus ?? "");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reasons = REASONS[status] ?? [];

  const handleSave = async () => {
    if (!status) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    logMonetisationClientEvent("outcome_quicklog_open", applicationId, "outcomes", { status });
    try {
      const res = await fetch("/api/outcomes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          status,
          reason: reason || undefined,
          notes: note || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Could not save outcome.");
        logMonetisationClientEvent("outcome_quicklog_save_fail", applicationId, "outcomes", { status });
      } else {
        setMessage("Outcome saved");
        logMonetisationClientEvent("outcome_quicklog_save_success", applicationId, "outcomes", { status });
        onSaved?.({ status, reason: reason || null, notes: note || null });
      }
    } catch (err) {
      console.error("[outcome.quicklog]", err);
      setError("Could not save outcome.");
      logMonetisationClientEvent("outcome_quicklog_save_fail", applicationId, "outcomes", { status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{OUTCOME_COPY.TITLE}</p>
          <p className="text-sm text-[rgb(var(--muted))]">{OUTCOME_COPY.SUBTITLE}</p>
        </div>
        {message ? <span className="text-xs text-emerald-700">{OUTCOME_COPY.SUCCESS}</span> : null}
        {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          <option value="">Choose status</option>
          {OUTCOME_STATUSES.filter((s) =>
            ["offer", "interview_scheduled", "rejected", "no_response", "withdrawn", "accepted"].includes(s)
          ).map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          disabled={!reasons.length}
        >
          <option value="">{OUTCOME_COPY.REASON_PROMPT}</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!status || saving}
        >
          {saving ? "Saving…" : "Save outcome"}
        </button>
      </div>
    </div>
  );
}
