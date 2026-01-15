"use client";

import Link from "next/link";
import { useMemo } from "react";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import { computeWizardState } from "@/lib/apply-kit-wizard";
import { addBusinessDays, formatUkDate } from "@/lib/tracking-utils";

type WizardProps = {
  applicationId: string;
  jobTextLength: number;
  jobTextStatus?: string | null;
  jobTextSource?: string | null;
  hasJobUrl: boolean;
  evidenceGapsWithSelection: number;
  totalGaps: number;
  starDraftCount: number;
  autopackReady: boolean;
  submittedAt?: string | null;
  setSubmittedAction: (formData: FormData) => Promise<ActionState>;
  scheduleFollowupAction: (formData: FormData) => Promise<ActionState>;
};

function statusPill(state: "ready" | "attention" | "blocked") {
  if (state === "ready") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (state === "attention") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-rose-50 text-rose-700";
}

export default function ApplyKitWizard({
  applicationId,
  jobTextLength,
  jobTextStatus,
  jobTextSource,
  hasJobUrl,
  evidenceGapsWithSelection,
  totalGaps,
  starDraftCount,
  autopackReady,
  submittedAt,
  setSubmittedAction,
  scheduleFollowupAction,
}: WizardProps) {
  const state = useMemo(
    () =>
      computeWizardState({
        jobTextLength,
        evidenceGapsWithSelection,
        totalGaps,
        starDraftCount,
        autopackReady,
        submitted: Boolean(submittedAt),
      }),
    [
      jobTextLength,
      evidenceGapsWithSelection,
      totalGaps,
      starDraftCount,
      autopackReady,
      submittedAt,
    ]
  );

  const followupDate = useMemo(() => {
    const date = addBusinessDays(new Date(), 3);
    return formatUkDate(date.toISOString());
  }, []);

  const markSubmitted = async () => {
    const formData = new FormData();
    formData.set("application_id", applicationId);
    formData.set("submitted_at", new Date().toISOString());
    formData.set("status", "submitted");
    await setSubmittedAction(formData);
  };

  const scheduleFollowup = async () => {
    const formData = new FormData();
    formData.set("application_id", applicationId);
    formData.set("next_followup_at", followupDate);
    await scheduleFollowupAction(formData);
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Apply Kit Wizard
          </p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Guided steps from advert to submission
          </p>
        </div>
        <div className="text-xs text-[rgb(var(--muted))]">
          Next step: <span className="font-semibold">{state.nextActionId.replace("-", " ")}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Step 1 */}
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/60 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(state.steps[0].state)}`}>
              {state.steps[0].state === "ready"
                ? "Job text ready"
                : state.steps[0].state === "attention"
                ? "Job text may be short"
                : "Job text missing"}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Step 1 · Job advert text
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              {jobTextSource
                ? `Using ${jobTextSource} (${jobTextLength} chars)`
                : `${jobTextLength} chars`}
            </p>
            {state.steps[0].state === "blocked" ? (
              <p className="text-xs text-rose-700">
                Paste the job description (fetch may be blocked).
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {hasJobUrl ? (
              <Link
                href={`/app/applications/${applicationId}?tab=overview#job-advert`}
                className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
              >
                Go to Job advert
              </Link>
            ) : null}
            <Link
              href={`/app/applications/${applicationId}?tab=overview#job-advert`}
              className="text-xs text-[rgb(var(--muted))]"
            >
              Paste / refresh
            </Link>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/60 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(state.steps[1].state)}`}>
              {state.steps[1].state === "ready"
                ? "Evidence set"
                : state.steps[1].state === "attention"
                ? "Partial evidence"
                : "Evidence missing"}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Step 2 · Evidence for gaps
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              {evidenceGapsWithSelection} gap(s) covered · {totalGaps} gaps detected
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/applications/${applicationId}?tab=evidence#role-fit`}
              className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            >
              Open Evidence tab
            </Link>
            <Link
              href={`/app/applications/${applicationId}?tab=evidence#role-fit`}
              className="text-xs text-[rgb(var(--muted))]"
            >
              Auto-suggest
            </Link>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/60 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(state.steps[2].state)}`}>
              {state.steps[2].state === "ready"
                ? "STAR ready"
                : "Create a STAR draft"}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Step 3 · STAR draft
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              {starDraftCount} draft(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/applications/${applicationId}?tab=evidence#star-library`}
              className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            >
              Open STAR Library
            </Link>
            <Link
              href={`/app/applications/${applicationId}?tab=evidence#star-library`}
              className="text-xs text-[rgb(var(--muted))]"
            >
              Create starter STAR draft
            </Link>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/60 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(state.steps[3].state)}`}>
              {autopackReady ? "Kit ready" : "Generate kit"}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Step 4 · Download Application Kit
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              CV + Cover (ATS-Minimal) + Interview Pack + STAR JSON
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/applications/${applicationId}?tab=apply#apply-autopacks`}
              className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            >
              Generate Autopack
            </Link>
            <Link
              href={`/app/applications/${applicationId}?tab=apply#apply-kit`}
              className="text-xs text-[rgb(var(--muted))]"
            >
              Download kit
            </Link>
          </div>
        </div>

        {/* Step 5 */}
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white/60 p-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(state.steps[4].state)}`}>
              {submittedAt ? "Submitted" : "Not submitted"}
            </div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Step 5 · Mark submitted + schedule follow-up
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              Follow-ups keep momentum after submission.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={markSubmitted}>
              Mark as submitted
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={scheduleFollowup}
            >
              Schedule follow-up (+3 working days)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
