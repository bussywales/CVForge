"use client";

import { useMemo, useState, useTransition } from "react";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";
import {
  applicationStatusOptions,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import {
  deriveNeedsFollowUp,
  formatDateUk,
  formatUkDate,
  isDueToday,
  isOverdue,
} from "@/lib/tracking-utils";
import { getOutreachStageLabel } from "@/lib/outreach-utils";
import PipelineActionCentre from "./pipeline-action-centre";

const statusValues = applicationStatusOptions.map((option) => option.value);

type PipelineBoardProps = {
  applications: ApplicationRecord[];
  lastActivityById: Record<string, string>;
  onUpdateStatus: (formData: FormData) => Promise<ActionState>;
  dueTodayCount: number;
  overdueCount: number;
};

export default function PipelineBoard({
  applications,
  lastActivityById,
  onUpdateStatus,
  dueTodayCount,
  overdueCount,
}: PipelineBoardProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    statusValues
  );
  const [search, setSearch] = useState("");
  const [needsFollowupOnly, setNeedsFollowupOnly] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"today" | "overdue" | null>(
    null
  );
  const [invitesOnly, setInvitesOnly] = useState(false);
  const [hideLost, setHideLost] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((app) => {
      const status = normaliseApplicationStatus(app.status);
      if (!selectedStatuses.includes(status)) {
        return false;
      }
      if (needsFollowupOnly && !deriveNeedsFollowUp(status, app.next_action_due)) {
        return false;
      }
      const outcomeStatus = app.last_outcome_status ?? app.outcome_status;
      if (
        invitesOnly &&
        !["interview_scheduled", "interview_completed", "offer", "accepted"].includes(
          outcomeStatus ?? ""
        )
      ) {
        return false;
      }
      if (
        hideLost &&
        ["rejected", "no_response", "withdrawn"].includes(outcomeStatus ?? "")
      ) {
        return false;
      }
      if (quickFilter === "today" && !isDueToday(app.next_action_due)) {
        return false;
      }
      if (quickFilter === "overdue" && !isOverdue(app.next_action_due)) {
        return false;
      }
      if (term) {
        const haystack = `${app.job_title} ${app.company_name ?? ""} ${
          app.company ?? ""
        }`;
        if (!haystack.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [
    applications,
    needsFollowupOnly,
    invitesOnly,
    hideLost,
    quickFilter,
    search,
    selectedStatuses,
  ]);

  const grouped = useMemo(() => {
    const map: Record<string, ApplicationRecord[]> = {};
    statusValues.forEach((status) => {
      map[status] = [];
    });
    filtered.forEach((app) => {
      const status = normaliseApplicationStatus(app.status);
      if (!map[status]) {
        map[status] = [];
      }
      map[status].push(app);
    });
    return map;
  }, [filtered]);

  const handleStatusChange = (application: ApplicationRecord, status: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", application.id);
      formData.set("status", status);
      formData.set("applied_at", application.applied_at ?? "");
      formData.set("next_followup_at", application.next_followup_at ?? "");
      formData.set("contact_name", application.contact_name ?? "");
      formData.set("contact_role", application.contact_role ?? "");
      formData.set("contact_email", application.contact_email ?? "");
      formData.set("contact_linkedin", application.contact_linkedin ?? "");
      formData.set("company_name", application.company_name ?? "");
      formData.set("source", application.source ?? "");
      const result = await onUpdateStatus(formData);
      if (result.status === "error") {
        console.error("[pipeline.updateStatus]", result.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setQuickFilter((prev) => (prev === "today" ? null : "today"))
              }
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                quickFilter === "today"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-white/80 text-[rgb(var(--ink))]"
              }`}
            >
              <span>Due today</span>
              <span className="text-xs font-semibold">{dueTodayCount}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setQuickFilter((prev) => (prev === "overdue" ? null : "overdue"))
              }
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                quickFilter === "overdue"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-black/10 bg-white/80 text-[rgb(var(--ink))]"
              }`}
            >
              <span>Overdue</span>
              <span className="text-xs font-semibold">{overdueCount}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Filters
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {applicationStatusOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(option.value)}
                      onChange={(event) => {
                        setSelectedStatuses((prev) => {
                          if (event.target.checked) {
                            return [...prev, option.value];
                          }
                          return prev.filter((status) => status !== option.value);
                        });
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <input
                  type="checkbox"
                  checked={needsFollowupOnly}
                  onChange={(event) => setNeedsFollowupOnly(event.target.checked)}
                />
                Needs follow-up
              </label>
              <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <input
                  type="checkbox"
                  checked={invitesOnly}
                  onChange={(event) => setInvitesOnly(event.target.checked)}
                />
                Interview invites only
              </label>
              <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <input
                  type="checkbox"
                  checked={hideLost}
                  onChange={(event) => setHideLost(event.target.checked)}
                />
                Hide lost
              </label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or company"
                className="w-64 rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {applicationStatusOptions.map((column) => (
          <div key={column.value} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {column.label}
              </p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[rgb(var(--muted))]">
                {grouped[column.value]?.length ?? 0}
              </span>
            </div>
            <div className="space-y-3">
              {(grouped[column.value] ?? []).map((app) => {
                const status = normaliseApplicationStatus(app.status);
                const lastActivity =
                  lastActivityById[app.id] ??
                  app.last_activity_at ??
                  app.last_touch_at;
                const outcomeStatus = app.last_outcome_status ?? app.outcome_status;
                const outcomeDate =
                  app.last_outcome_at ?? app.outcome_at ?? undefined;
                const lastActivityLabel = lastActivity
                  ? formatDateUk(lastActivity)
                  : "No activity yet";
                const nextActionLabel = app.next_action_due
                  ? formatUkDate(app.next_action_due)
                  : "Not set";
                const outreachLabel = getOutreachStageLabel(app.outreach_stage);
                const outreachDueLabel = app.outreach_next_due_at
                  ? formatDateUk(app.outreach_next_due_at)
                  : "Not set";
                const isDue = isDueToday(app.next_action_due) || isOverdue(app.next_action_due);
                const needsFollowup = deriveNeedsFollowUp(
                  status,
                  app.next_action_due
                );
                return (
                  <div
                    key={app.id}
                    className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                          {app.job_title}
                        </p>
                        <p className="text-xs text-[rgb(var(--muted))]">
                          {app.company_name || app.company || "Company not set"}
                        </p>
                        {outcomeStatus ? (
                          <span
                            title={
                              outcomeDate
                                ? `Recorded ${formatDateUk(outcomeDate)}`
                                : undefined
                            }
                            className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700"
                          >
                            {outcomeStatus.replace("_", " ")}
                          </span>
                        ) : null}
                        <div className="mt-3 space-y-1 text-xs text-[rgb(var(--muted))]">
                          <p>Last activity: {lastActivityLabel}</p>
                          <p>Next action: {nextActionLabel}</p>
                          <p>Outreach: {outreachLabel} · {outreachDueLabel}</p>
                        </div>
                      </div>
                      {needsFollowup ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isDue
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Needs follow-up
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <select
                        defaultValue={normaliseApplicationStatus(app.status)}
                        onChange={(event) =>
                          handleStatusChange(app, event.target.value)
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                      >
                        {applicationStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="whitespace-nowrap"
                          onClick={() => {
                            setActiveId(app.id);
                          }}
                          disabled={isPending}
                        >
                          Actions
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="whitespace-nowrap"
                          onClick={() => {
                            window.location.href = `/app/applications/${app.id}`;
                          }}
                          disabled={isPending}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {grouped[column.value]?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-xs text-[rgb(var(--muted))]">
                  No applications.
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {activeId ? (
        <PipelineActionCentre
          application={applications.find((app) => app.id === activeId) ?? null}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </div>
  );
}
