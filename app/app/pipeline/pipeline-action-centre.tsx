"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";
import type { InterviewLiftResult } from "@/lib/interview-lift";
import {
  buildFollowupTemplates,
  buildLinkedInTemplate,
} from "@/lib/followup-templates";
import {
  nextActionTypeOptions,
} from "@/lib/validators/application-tracking";
import { formatUkDate } from "@/lib/tracking-utils";
import InterviewLiftPanel from "../applications/interview-lift-panel";
import {
  logPipelineActivityAction,
  updateNextActionAction,
} from "../applications/actions";

const quickActions = [
  { value: "applied", label: "Applied" },
  { value: "followup", label: "Followed up" },
  { value: "call", label: "Called" },
  { value: "interview", label: "Interview scheduled" },
  { value: "rejection", label: "Rejected" },
  { value: "offer", label: "Offer" },
];

type PipelineActionCentreProps = {
  application: ApplicationRecord | null;
  onClose: () => void;
};

export default function PipelineActionCentre({
  application,
  onClose,
}: PipelineActionCentreProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [activityLogged, setActivityLogged] = useState(false);
  const [liftResult, setLiftResult] = useState<InterviewLiftResult | null>(null);
  const [liftAchievements, setLiftAchievements] = useState<
    Array<{ id: string; title: string; metrics: string | null }>
  >([]);
  const [liftError, setLiftError] = useState<string | null>(null);
  const [nextActionType, setNextActionType] = useState(
    application?.next_action_type ?? ""
  );
  const [nextActionDue, setNextActionDue] = useState(
    application?.next_action_due ?? ""
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setActivityLogged(false);
  }, [application?.id]);

  const templates = useMemo(() => {
    if (!application) {
      return null;
    }
    const baseInput = {
      contactName: application.contact_name,
      companyName: application.company_name ?? application.company,
      jobTitle: application.job_title,
      jobUrl: application.job_url ?? undefined,
    };
    const emailTemplate = buildFollowupTemplates(baseInput)[0];
    const linkedinTemplate = buildLinkedInTemplate(baseInput);
    return { emailTemplate, linkedinTemplate };
  }, [application]);

  useEffect(() => {
    if (!application) {
      return;
    }
    setLiftError(null);
    const controller = new AbortController();
    fetch(`/api/applications/${application.id}/interview-lift`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.interviewLift) {
          setLiftResult(payload.interviewLift);
          setLiftAchievements(payload.achievements ?? []);
        } else if (payload?.error) {
          setLiftError(payload.error);
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.error("[pipeline.lift]", error);
        setLiftError("Unable to load interview lift guidance.");
      });
    return () => controller.abort();
  }, [application]);

  const refreshLift = () => {
    if (!application) {
      return;
    }
    fetch(`/api/applications/${application.id}/interview-lift`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.interviewLift) {
          setLiftResult(payload.interviewLift);
          setLiftAchievements(payload.achievements ?? []);
          setLiftError(null);
        } else if (payload?.error) {
          setLiftError(payload.error);
        }
      })
      .catch((error) => {
        console.error("[pipeline.lift.refresh]", error);
        setLiftError("Unable to refresh interview lift guidance.");
      });
  };

  if (!application || !templates) {
    return null;
  }

  const calendarUrl =
    application.next_action_due || application.next_followup_at
      ? `/api/calendar/followup?applicationId=${application.id}`
      : null;

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Copied.");
    } catch (error) {
      console.error("[pipeline.copy]", error);
      setToast("Unable to copy right now.");
    }
  };

  const handleLogActivity = async (type: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", application.id);
      formData.set("type", type);
      const result = await logPipelineActivityAction(formData);
      if (result.status === "success") {
        setToast(result.message ?? "Activity logged.");
        setActivityLogged(true);
        refreshLift();
        router.refresh();
      } else if (result.message) {
        setToast(result.message);
      }
    });
  };

  const handleUpdateNextAction = async (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", application.id);
      formData.set("next_action_type", nextActionType);
      formData.set("next_action_due", nextActionDue);
      const result: ActionState = await updateNextActionAction(formData);
      if (result.status === "success") {
        setToast(result.message ?? "Next action updated.");
        router.refresh();
      } else if (result.message) {
        setToast(result.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4">
      <div
        className="absolute inset-0"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-black/10 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[rgb(var(--ink))]">
              Action centre
            </p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              {application.job_title} · {application.company_name || application.company || "Company"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm font-semibold text-[rgb(var(--ink))]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {toast ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {toast}
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Follow-up templates
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                Copy and paste these into email or LinkedIn.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  Email follow-up
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleCopy(templates.emailTemplate.body)}
                  disabled={isPending}
                >
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Subject
              </p>
              <p className="mt-1 text-sm text-[rgb(var(--ink))]">
                {templates.emailTemplate.subject}
              </p>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">
                {templates.emailTemplate.body}
              </pre>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  LinkedIn DM
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleCopy(templates.linkedinTemplate.body)}
                  disabled={isPending}
                >
                  Copy
                </Button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">
                {templates.linkedinTemplate.body}
              </pre>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Log activity
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                One click to capture touchpoints and update status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.value}
                  type="button"
                  variant="secondary"
                  onClick={() => handleLogActivity(action.value)}
                  disabled={isPending}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Next best actions
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                {activityLogged
                  ? "Activity logged. Here are the next best actions to lift interviews."
                  : "Complete one of these quick actions to lift your chances."}
              </p>
            </div>
            {liftError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {liftError}
              </div>
            ) : liftResult ? (
              <InterviewLiftPanel
                applicationId={application.id}
                result={liftResult}
                achievements={liftAchievements}
                showTitle={false}
                compact
                onActionComplete={refreshLift}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-xs text-[rgb(var(--muted))]">
                Loading interview lift actions…
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Next action & reminder
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">
                Schedule the next step and add a reminder.
              </p>
            </div>
            <form onSubmit={handleUpdateNextAction} className="space-y-3">
              <FormField label="Next action" htmlFor="next_action_type">
                <select
                  id="next_action_type"
                  value={nextActionType}
                  onChange={(event) => setNextActionType(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm"
                >
                  <option value="">Select</option>
                  {nextActionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Next action due" htmlFor="next_action_due">
                <input
                  id="next_action_due"
                  type="date"
                  value={nextActionDue}
                  onChange={(event) => setNextActionDue(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm"
                />
              </FormField>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save next action"}
                </Button>
                {calendarUrl ? (
                  <a
                    href={calendarUrl}
                    className="text-sm font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                  >
                    Generate calendar invite (.ics)
                  </a>
                ) : null}
              </div>
            </form>
            {application.next_action_due ? (
              <p className="text-xs text-[rgb(var(--muted))]">
                Current due date: {formatUkDate(application.next_action_due)}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
