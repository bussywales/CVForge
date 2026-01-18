"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import { OUTREACH_COPY } from "@/lib/outreach-microcopy";
import { describeFollowupStatus, type OutreachRecommendation } from "@/lib/outreach-engine";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import {
  createFollowupFromTemplateAction,
  scheduleFollowupAction,
  markOutreachRepliedAction,
  closeOutreachAction,
} from "./actions";
import { useEffect } from "react";

type OutreachPanelProps = {
  applicationId: string;
  statusLabel: string;
  recommendation: OutreachRecommendation | null;
  nextDue?: string | null;
};

export default function OutreachPanel({
  applicationId,
  statusLabel,
  recommendation,
  nextDue,
}: OutreachPanelProps) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subject = recommendation?.subject ?? "";
  const body = recommendation?.body ?? "";
  const dueLabel = describeFollowupStatus(nextDue ?? recommendation?.dueAt);

  useMemo(() => {
    setMessage(body);
  }, [body]);

  useEffect(() => {
    logMonetisationClientEvent("outreach_panel_view", applicationId, "applications", {
      stage: recommendation?.stage,
    });
  }, [applicationId, recommendation?.stage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      logMonetisationClientEvent("outreach_copy_click", applicationId, "applications", {
        stage: recommendation?.stage,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error("[outreach.copy]", error);
    }
  };

  const handleSchedule = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      await scheduleFollowupAction(formData);
      logMonetisationClientEvent("outreach_schedule_next", applicationId, "applications", {});
    });
  };

  const handleOutcome = (value: string | null) => {
    setSelectedOutcome(value);
    if (!value) return;
    startTransition(async () => {
      if (value === "reply") {
        const formData = new FormData();
        formData.set("application_id", applicationId);
        await markOutreachRepliedAction(formData);
      } else if (value === "not_relevant") {
        const formData = new FormData();
        formData.set("application_id", applicationId);
        await closeOutreachAction(formData);
      }
    });
  };

  return (
    <div id="outreach" className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {OUTREACH_COPY.TITLE}
          </p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            {OUTREACH_COPY.SUBTITLE}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-700">
            {dueLabel}
          </span>
          {nextDue ? (
            <span className="text-[10px] text-[rgb(var(--muted))]">
              Next follow-up: {new Date(nextDue).toLocaleDateString()}
            </span>
          ) : null}
        </div>

        {recommendation ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {subject ? (
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {subject}
                  </p>
                ) : null}
                <p className="text-xs text-[rgb(var(--muted))]">
                  {recommendation.stage ? recommendation.stage.replace(/_/g, " ") : "Follow-up"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                >
                  {copied ? "Copied" : OUTREACH_COPY.CTA_COPY}
                </button>
                <form
                  action={createFollowupFromTemplateAction}
                  onSubmit={() =>
                    logMonetisationClientEvent(
                      "outreach_log_sent",
                      applicationId,
                      "applications",
                      { stage: recommendation.stage }
                    )
                  }
                >
                  <input type="hidden" name="application_id" value={applicationId} />
                  <input type="hidden" name="subject" value={subject} />
                  <input type="hidden" name="body" value={message} />
                  <Button type="submit" disabled={isPending}>
                    {OUTREACH_COPY.CTA_LOG}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={handleSchedule}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  disabled={isPending}
                >
                  {OUTREACH_COPY.CTA_SCHEDULE}
                </button>
              </div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">
              {message}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--muted))]">
            {OUTREACH_COPY.STATE_NONE}
          </p>
        )}

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <p className="text-xs font-semibold text-[rgb(var(--muted))]">
            If they reply
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOutcome("reply")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "reply"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              Reply received
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("no_reply")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "no_reply"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              No reply yet
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("not_relevant")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "not_relevant"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              Not relevant
            </button>
          </div>
          <textarea
            className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            If you received a reply, log the outcome next to keep pipeline stats tidy.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
          <span>{OUTREACH_COPY.QUEUE_EMPTY}</span>
          <Link
            href={`/app/applications/${applicationId}?tab=activity#activity-log`}
            className="text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          >
            {OUTREACH_COPY.CTA_OPEN}
          </Link>
        </div>
      </div>
    </div>
  );
}
