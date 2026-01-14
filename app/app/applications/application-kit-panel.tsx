"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import type { KitChecklistItem, KitNextAction } from "@/lib/application-kit";
import { formatDateTimeUk, formatUkDate, toDateInputValue } from "@/lib/tracking-utils";

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

type SmartApplyPanelProps = {
  applicationId: string;
  closingDate: string | null;
  submittedAt: string | null;
  sourcePlatform: string | null;
  checklist: KitChecklistItem[];
  score: number;
  nextActions: KitNextAction[];
  downloadEnabled: boolean;
  downloadHint?: string;
  contents: string[];
  updateClosingDateAction: (formData: FormData) => Promise<ActionState>;
  updateSourcePlatformAction: (formData: FormData) => Promise<ActionState>;
  setSubmittedAction: (formData: FormData) => Promise<ActionState>;
  scheduleFollowupAction: (formData: FormData) => Promise<ActionState>;
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
  checklist,
  score,
  nextActions,
  downloadEnabled,
  downloadHint,
  contents,
  updateClosingDateAction,
  updateSourcePlatformAction,
  setSubmittedAction,
  scheduleFollowupAction,
}: SmartApplyPanelProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const [showContents, setShowContents] = useState(false);

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

  const downloadKit = async () => {
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
      setState({ status: "idle" });
    } catch (error) {
      console.error("[smart-apply.export]", error);
      setState({
        status: "error",
        message: "Export failed. Please try again.",
      });
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
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Track readiness, submissions, and next steps in one place.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${scoreTone}`}
          >
            Apply readiness {score}/100
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <form
            action={updateClosingDateAction}
            className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3"
          >
            <input type="hidden" name="application_id" value={applicationId} />
            <label className="text-xs font-semibold text-[rgb(var(--muted))]">
              Closing date
              <input
                type="date"
                name="closing_date"
                defaultValue={toDateInputValue(closingDate)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
              <span>{closingDate ? formatUkDate(closingDate) : "Not set"}</span>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </div>
          </form>

          <form
            action={updateSourcePlatformAction}
            className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3"
          >
            <input type="hidden" name="application_id" value={applicationId} />
            <label className="text-xs font-semibold text-[rgb(var(--muted))]">
              Source platform
              <input
                type="text"
                name="source_platform"
                defaultValue={sourcePlatform ?? ""}
                placeholder="LinkedIn, NHS Jobs, Indeed"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
              <span>{sourcePlatform ? "Saved" : "Not set"}</span>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/80 p-3">
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
                <Button type="submit" variant={submittedAt ? "secondary" : "primary"}>
                  {submittedAt ? "Undo Submitted" : "Mark as Submitted"}
                </Button>
              </form>
              <form action={scheduleFollowupAction}>
                <input type="hidden" name="application_id" value={applicationId} />
                <Button type="submit" variant="ghost">
                  Schedule follow-up (3 business days)
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          Submission Checklist
        </p>
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
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Smart Next Actions
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={downloadKit}
          disabled={!downloadEnabled || state.status === "loading"}
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

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
