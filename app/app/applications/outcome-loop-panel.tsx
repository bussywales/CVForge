"use client";

import { useEffect, useMemo, useState } from "react";
import type { OutcomeRecord } from "@/lib/data/outcomes";
import type { ActionSummary, OutcomeInsight } from "@/lib/outcome-loop";
import { formatDateUk, formatDateTimeUk } from "@/lib/tracking-utils";
import OutcomeQuickLog from "@/components/OutcomeQuickLog";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type OutcomeLoopPanelProps = {
  applicationId: string;
  initialOutcomes: OutcomeRecord[];
  actionSummary: ActionSummary;
  lastOutcomeStatus?: string | null;
  lastOutcomeAt?: string | null;
};

export default function OutcomeLoopPanel({
  applicationId,
  initialOutcomes,
  actionSummary,
  lastOutcomeStatus,
  lastOutcomeAt,
}: OutcomeLoopPanelProps) {
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>(initialOutcomes);
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
          logMonetisationClientEvent("outcome_insights_view", applicationId, "outcomes");
        } else if (payload?.message) {
          setInsightsMessage(payload.message);
        }
      } catch (error) {
        console.error("[outcomes.insights]", error);
      }
    };
    loadInsights();
  }, [applicationId]);

  const actionEntries = useMemo(
    () =>
      Object.entries(actionSummary).filter(([, value]) => Number(value) > 0),
    [actionSummary]
  );

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
      </div>

      <div className="mt-4">
        <OutcomeQuickLog
          applicationId={applicationId}
          defaultStatus={lastOutcomeStatus ?? undefined}
          onSaved={(payload) =>
            setOutcomes((prev) => [
              {
                id: `local-${Date.now()}`,
                application_id: applicationId,
                outcome_status: payload.status,
                outcome_reason: payload.reason ?? null,
                outcome_notes: payload.notes ?? null,
                happened_at: new Date().toISOString(),
              } as any,
              ...prev,
            ])
          }
        />
      </div>

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
