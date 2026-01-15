"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import type { OutcomeRecord } from "@/lib/data/outcomes";
import type { ActionSummary, OutcomeInsight } from "@/lib/outcome-loop";
import {
  OUTCOME_REASON_CODES,
  OUTCOME_STATUSES,
} from "@/lib/outcome-loop";
import { formatDateUk, formatDateTimeUk } from "@/lib/tracking-utils";

type OutcomeLoopPanelProps = {
  applicationId: string;
  initialOutcomes: OutcomeRecord[];
  actionSummary: ActionSummary;
  lastOutcomeStatus?: string | null;
  lastOutcomeAt?: string | null;
};

type SaveState = "idle" | "saving" | "error" | "saved";

function reasonCodesForStatus(status: string | null) {
  if (!status) return OUTCOME_REASON_CODES;
  if (["rejected", "no_response", "withdrawn"].includes(status)) {
    return OUTCOME_REASON_CODES;
  }
  return [];
}

export default function OutcomeLoopPanel({
  applicationId,
  initialOutcomes,
  actionSummary,
  lastOutcomeStatus,
  lastOutcomeAt,
}: OutcomeLoopPanelProps) {
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>(initialOutcomes);
  const [status, setStatus] = useState<string>(lastOutcomeStatus ?? "");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [insights, setInsights] = useState<OutcomeInsight[] | null>(null);
  const [insightsMessage, setInsightsMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const response = await fetch("/api/outcomes/insights", {
          credentials: "include",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload?.insights) {
          setInsights(payload.insights);
        } else if (payload?.message) {
          setInsightsMessage(payload.message);
        }
      } catch (error) {
        console.error("[outcomes.insights]", error);
      }
    };
    loadInsights();
  }, []);

  const reasonOptions = reasonCodesForStatus(status);

  const actionEntries = useMemo(
    () =>
      Object.entries(actionSummary).filter(([, value]) => Number(value) > 0),
    [actionSummary]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status) return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/outcomes/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          status,
          reason: reason || null,
          notes: notes || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.outcome) {
        setSaveState("error");
        return;
      }
      setOutcomes((prev) => [payload.outcome, ...prev].slice(0, 10));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (error) {
      console.error("[outcomes.save]", error);
      setSaveState("error");
    }
  };

  const lastOutcome = outcomes[0] ?? null;
  const headerStatus = lastOutcome?.outcome_status ?? lastOutcomeStatus;
  const headerAt = lastOutcome?.happened_at ?? lastOutcomeAt;

  return (
    <div
      className="rounded-2xl border border-black/10 bg-white/70 p-4"
      id="outcome-loop"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Outcome Loop
          </p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {headerStatus
              ? `Last outcome: ${headerStatus.replace("_", " ")}`
              : "No outcome recorded yet"}
          </p>
          {headerAt ? (
            <p className="text-xs text-[rgb(var(--muted))]">
              {formatDateTimeUk(headerAt)}
            </p>
          ) : null}
        </div>
        {saveState === "saved" ? (
          <span className="text-xs text-emerald-700">Outcome saved ✓</span>
        ) : saveState === "error" ? (
          <span className="text-xs text-rose-700">
            Could not save outcome.
          </span>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 md:grid-cols-3"
      >
        <label className="text-sm text-[rgb(var(--muted))]">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            required
          >
            <option value="">Choose status</option>
            {OUTCOME_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[rgb(var(--muted))]">
          Reason (optional)
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            disabled={!reasonOptions.length}
          >
            <option value="">Not set</option>
            {reasonOptions.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[rgb(var(--muted))]">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={1}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            placeholder="Interview round, rejection reason, etc."
          />
        </label>
        <div className="md:col-span-3">
          <Button type="submit" disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      </form>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white/60 p-4">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Recent outcomes
          </p>
          {outcomes.length === 0 ? (
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              None recorded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {outcomes.map((outcome) => (
                <li
                  key={outcome.id}
                  className="rounded-xl border border-black/5 bg-white/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.15em] text-[rgb(var(--muted))]">
                      {outcome.outcome_status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-[rgb(var(--muted))]">
                      {formatDateUk(outcome.happened_at)}
                    </span>
                  </div>
                  {outcome.outcome_reason ? (
                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                      Reason: {outcome.outcome_reason.replace("_", " ")}
                    </p>
                  ) : null}
                  {outcome.outcome_notes ? (
                    <p className="mt-1 text-sm text-[rgb(var(--ink))]">
                      {outcome.outcome_notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white/60 p-4">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Actions snapshot
          </p>
          {actionEntries.length === 0 ? (
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              No actions recorded yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {actionEntries.map(([key, value]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-[rgb(var(--muted))]">
                    {key.replaceAll("_", " ")}
                  </span>
                  <span className="font-semibold text-[rgb(var(--ink))]">
                    {value}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm font-semibold text-[rgb(var(--ink))]">
            Insights
          </p>
          {insights && insights.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {insights.map((insight, index) => (
                <li key={index} className="text-[rgb(var(--muted))]">
                  • {insight.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              {insightsMessage ?? "Not enough outcomes yet to spot patterns."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
