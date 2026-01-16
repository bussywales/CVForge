"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import type { KitChecklistItem, KitNextAction } from "@/lib/application-kit";
import { formatDateTimeUk, formatUkDate, toDateInputValue } from "@/lib/tracking-utils";
import { needsHardGate, shouldSoftGate } from "@/lib/billing/gating";
import CreditGateModal from "@/app/app/billing/credit-gate-modal";
import { addResumeParam, savePendingAction, buildReturnToUrl } from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { getActionRoiLine } from "@/lib/billing/action-roi";

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

type SmartApplyPanelProps = {
  applicationId: string;
  closingDate: string | null;
  submittedAt: string | null;
  sourcePlatform: string | null;
  outcomeStatus?: string | null;
  outcomeNote?: string | null;
  checklist: KitChecklistItem[];
  score: number;
  nextActions: KitNextAction[];
  cadence?: {
    id: string;
    label: string;
    dueAt?: string | null;
    channel?: "email" | "linkedin";
    templateId?: string;
    reason?: string;
  } | null;
  followupTemplate?: { subject: string; body: string; label: string } | null;
  downloadEnabled: boolean;
  downloadHint?: string;
  contents: string[];
  balance: number;
  returnTo?: string;
  updateClosingDateAction: (formData: FormData) => Promise<ActionState>;
  updateSourcePlatformAction: (formData: FormData) => Promise<ActionState>;
  setSubmittedAction: (formData: FormData) => Promise<ActionState>;
  scheduleFollowupAction: (formData: FormData) => Promise<ActionState>;
  logFollowupCadenceAction: (formData: FormData) => Promise<ActionState>;
  setOutcomeAction: (formData: FormData) => Promise<ActionState>;
};

function getFilenameFromDisposition(
  disposition: string | null,
  fallback: string
) {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename="(.+?)"/);
  return match?.[1] ?? fallback;
}

export default function ApplicationKitPanel({
  applicationId,
  closingDate,
  submittedAt,
  sourcePlatform,
  outcomeStatus,
  outcomeNote,
  checklist,
  score,
  nextActions,
  cadence,
  followupTemplate,
  downloadEnabled,
  downloadHint,
  contents,
  balance,
  returnTo,
  updateClosingDateAction,
  updateSourcePlatformAction,
  setSubmittedAction,
  scheduleFollowupAction,
  logFollowupCadenceAction,
  setOutcomeAction,
}: SmartApplyPanelProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const [showContents, setShowContents] = useState(false);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const currentReturn =
    returnTo ??
    `/app/applications/${applicationId}?tab=apply#application-kit`;
  const resumeReturnTo = addResumeParam(currentReturn);
  const [showGate, setShowGate] = useState(false);

  const scoreTone = useMemo(() => {
    if (score >= 80) {
      return "bg-emerald-100 text-emerald-700";
    }
    if (score >= 60) {
      return "bg-amber-100 text-amber-700";
    }
    return "bg-red-100 text-red-700";
  }, [score]);

  const submittedLabel = submittedAt
    ? `Submitted ${formatDateTimeUk(submittedAt)}`
    : "Draft";
  const completedItems = checklist.filter((item) => item.ok).length;
  const totalItems = checklist.length;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );

  useEffect(() => {
    const key = `cvforge.apply.checklistCollapsed:${applicationId}`;
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (saved) {
      setChecklistCollapsed(saved === "true");
      return;
    }
    if (completedItems > 0) {
      setChecklistCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, completedItems]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { applicationId?: string } | undefined;
      if (detail?.applicationId === applicationId) {
        void downloadKit();
      }
    };
    window.addEventListener("cvf-resume-kit", handler);
    return () => window.removeEventListener("cvf-resume-kit", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const toggleChecklist = () => {
    const key = `cvforge.apply.checklistCollapsed:${applicationId}`;
    setChecklistCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, String(next));
      }
      return next;
    });
  };

  const downloadKit = async () => {
    if (needsHardGate(balance, 1)) {
      savePendingAction({
        type: "application_kit_download",
        applicationId,
        returnTo: buildReturnToUrl({
          type: "application_kit_download",
          applicationId,
          createdAt: Date.now(),
        } as any),
        createdAt: Date.now(),
      });
      logMonetisationClientEvent("gate_blocked", applicationId, "applications", {
        actionKey: "application_kit_download",
      });
      logMonetisationClientEvent("billing_clicked", applicationId, "applications", {
        actionKey: "application_kit_download",
      });
      window.location.href = `/app/billing?returnTo=${encodeURIComponent(resumeReturnTo)}`;
      return;
    }
    if (shouldSoftGate(balance, 1)) {
      savePendingAction({
        type: "application_kit_download",
        applicationId,
        returnTo: buildReturnToUrl({
          type: "application_kit_download",
          applicationId,
          createdAt: Date.now(),
        } as any),
        createdAt: Date.now(),
      });
      logMonetisationClientEvent("gate_shown", applicationId, "applications", {
        actionKey: "application_kit_download",
      });
      setShowGate(true);
      return;
    }
    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/application/${applicationId}/kit.zip`,
        { credentials: "include" }
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => ({}));
          setState({
            status: "error",
            message: payload?.error ?? "Export failed. Please try again.",
          });
        } else {
          setState({
            status: "error",
            message: "Export failed. Please try again.",
          });
        }
        return;
      }

      const blob = await response.blob();
      const filename = getFilenameFromDisposition(
        response.headers.get("content-disposition"),
        "cvforge-application-kit.zip"
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      logMonetisationClientEvent(
        "resume_completed",
        applicationId,
        "applications",
        { actionKey: "application_kit_download" }
      );
      window.dispatchEvent(
        new CustomEvent("cvf-resume-completed", {
          detail: { applicationId, actionKey: "application_kit_download" },
        })
      );
      setState({ status: "idle" });
    } catch (error) {
      console.error("[smart-apply.export]", error);
      setState({
        status: "error",
        message: "Export failed. Please try again.",
      });
    }
  };

  const copyTemplate = async () => {
    if (!followupTemplate) return;
    try {
      await navigator.clipboard.writeText(
        `${followupTemplate.subject}\n\n${followupTemplate.body}`
      );
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (error) {
      console.error("[followup.copy]", error);
      setCopyStatus("error");
    }
  };

  return (
    <div className="space-y-5" id="smart-apply">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Smart Apply
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">
              {completedItems} of {totalItems} steps complete
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${scoreTone}`}
          >
            Apply readiness {score}/100
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1.5fr_1fr_1fr]">
          <form
            action={updateClosingDateAction}
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 p-3"
          >
            <input type="hidden" name="application_id" value={applicationId} />
            <label className="flex flex-1 flex-col text-xs font-semibold text-[rgb(var(--muted))]">
              Closing date
              <input
                type="date"
                name="closing_date"
                defaultValue={toDateInputValue(closingDate)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-col items-end gap-1 text-xs text-[rgb(var(--muted))]">
              <span>{closingDate ? formatUkDate(closingDate) : "Not set"}</span>
              <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                Save
              </Button>
            </div>
          </form>

          <form
            action={updateSourcePlatformAction}
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 p-3"
          >
            <input type="hidden" name="application_id" value={applicationId} />
            <label className="flex flex-1 flex-col text-xs font-semibold text-[rgb(var(--muted))]">
              Source platform
              <input
                type="text"
                name="source_platform"
                defaultValue={sourcePlatform ?? ""}
                placeholder="LinkedIn, NHS Jobs, Indeed"
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-col items-end gap-1 text-xs text-[rgb(var(--muted))]">
              <span>{sourcePlatform ? "Saved" : "Not set"}</span>
              <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                Save
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3">
            <p className="text-xs font-semibold text-[rgb(var(--muted))]">Outcome</p>
            <form action={setOutcomeAction} className="space-y-2 text-xs">
              <input type="hidden" name="application_id" value={applicationId} />
              <select
                name="outcome_status"
                defaultValue={outcomeStatus ?? ""}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">Not set</option>
                <option value="interview_invite">Interview invite</option>
                <option value="rejected">Rejected</option>
                <option value="offer">Offer</option>
              </select>
              <textarea
                name="outcome_note"
                defaultValue={outcomeNote ?? ""}
                placeholder="Optional note"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
              <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                Save outcome
              </Button>
            </form>
          </div>

          <div
            className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3"
            id="apply-followup"
          >
            <p className="text-xs font-semibold text-[rgb(var(--muted))]">Status</p>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {submittedLabel}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <form action={setSubmittedAction}>
                <input type="hidden" name="application_id" value={applicationId} />
                <input
                  type="hidden"
                  name="submitted"
                  value={submittedAt ? "false" : "true"}
                />
                <Button
                  type="submit"
                  variant={submittedAt ? "secondary" : "primary"}
                  className="px-3 py-1 text-xs"
                >
                  {submittedAt ? "Undo Submitted" : "Mark as Submitted"}
                </Button>
              </form>
              <form action={scheduleFollowupAction}>
                <input type="hidden" name="application_id" value={applicationId} />
                <Button type="submit" variant="ghost" className="px-3 py-1 text-xs">
                  Schedule follow-up
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-black/10 bg-white/70 p-4"
        id="apply-next-actions-list"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Follow-up Autopilot
          </p>
          {cadence?.dueAt ? (
            <span className="text-xs text-[rgb(var(--muted))]">
              Due {cadence.dueAt}
            </span>
          ) : null}
        </div>
        {cadence ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/10 bg-white/70 p-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {cadence.label}
              </p>
              {cadence.reason ? (
                <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                  {cadence.reason}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                type="button"
                variant="secondary"
                className="px-3 py-1 text-xs"
                onClick={copyTemplate}
                disabled={!followupTemplate}
              >
                {copyStatus === "copied"
                  ? "Copied"
                  : copyStatus === "error"
                    ? "Copy failed"
                    : "Copy template"}
              </Button>
              <form action={logFollowupCadenceAction}>
                <input type="hidden" name="application_id" value={applicationId} />
                <input
                  type="hidden"
                  name="channel"
                  value={cadence.channel ?? "email"}
                />
                <input
                  type="hidden"
                  name="template_id"
                  value={cadence.templateId ?? "post-apply"}
                />
                {cadence.dueAt ? (
                  <input
                    type="hidden"
                    name="next_due"
                    value={cadence.dueAt}
                  />
                ) : null}
                <Button type="submit" className="px-3 py-1 text-xs">
                  Log + schedule
                </Button>
              </form>
              <Link
                href={`/api/calendar/followup?applicationId=${applicationId}`}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
              >
                ICS
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            No follow-up needed right now.
          </p>
        )}
      </div>

      <div
        className="rounded-2xl border border-black/10 bg-white/70 p-4"
        id="followup-autopilot"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Next 3 actions
          </p>
          {nextActions.length === 0 ? (
            <span className="text-xs text-emerald-700">All set.</span>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {nextActions.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-black/10 bg-white/70 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  {action.label}
                </p>
                {action.reason ? (
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                    {action.reason}
                  </p>
                ) : null}
              </div>
              <Link
                href={action.href}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Go
              </Link>
            </div>
          ))}
          {nextActions.length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted))]">
              Keep the kit updated and ready to submit.
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-2xl border border-black/10 bg-white/70 p-4"
        id="apply-checklist"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Submission Checklist
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              {completedItems} done • {totalItems - completedItems} pending
            </p>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="px-3 py-1 text-xs"
            onClick={toggleChecklist}
          >
            {checklistCollapsed ? "Show checklist" : "Hide checklist"}
          </Button>
        </div>
        {!checklistCollapsed ? (
          <div className="mt-3 space-y-3">
            {checklist.map((item) => {
              const doneAt = item.doneAt ? formatDateTimeUk(item.doneAt) : "";
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                      {item.ok && doneAt
                        ? `Done: ${doneAt}`
                        : item.hint}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                        item.ok
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.ok ? "Done" : "Pending"}
                    </span>
                    {!item.ok && item.actionHref ? (
                      <Link
                        href={item.actionHref}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                      >
                        Do it
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={downloadKit}
          disabled={!downloadEnabled || state.status === "loading"}
          id="kit"
        >
          {state.status === "loading"
            ? "Preparing kit..."
            : "Download Application Kit (ZIP)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowContents((prev) => !prev)}
        >
          {showContents ? "Hide kit contents" : "View kit contents"}
        </Button>
        {!downloadEnabled && downloadHint ? (
          <span className="text-xs text-[rgb(var(--muted))]">
            {downloadHint}
          </span>
        ) : null}
      </div>

      {showContents ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-xs text-[rgb(var(--muted))]">
          <p className="font-semibold text-[rgb(var(--ink))]">
            Included files
          </p>
          <ul className="mt-2 space-y-1">
            {contents.map((item) => (
              <li key={item} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CreditGateModal
        open={showGate}
        onClose={() => setShowGate(false)}
        cost={1}
        balance={balance}
        actionLabel="Download Application Kit"
        roiLine={getActionRoiLine("applicationKit.download")}
        referralHref="/app/billing#refer"
        onContinue={() => {
          setShowGate(false);
          downloadKit();
        }}
        onGoBilling={() => {
          logMonetisationClientEvent("billing_clicked", applicationId, "applications", {
            actionKey: "application_kit_download",
          });
          window.location.href = `/app/billing?returnTo=${encodeURIComponent(resumeReturnTo)}`;
        }}
      />

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
