"use client";

import { useMemo, useState, useTransition } from "react";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";
import {
  applicationStatusOptions,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import { formatDateUk, isFollowupDue } from "@/lib/tracking-utils";

const statusValues = applicationStatusOptions.map((option) => option.value);

type PipelineBoardProps = {
  applications: ApplicationRecord[];
  onUpdateStatus: (formData: FormData) => Promise<ActionState>;
};

export default function PipelineBoard({
  applications,
  onUpdateStatus,
}: PipelineBoardProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    statusValues
  );
  const [search, setSearch] = useState("");
  const [needsFollowupOnly, setNeedsFollowupOnly] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((app) => {
      const status = normaliseApplicationStatus(app.status);
      if (!selectedStatuses.includes(status)) {
        return false;
      }
      if (needsFollowupOnly && !isFollowupDue(app.next_followup_at)) {
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
  }, [applications, needsFollowupOnly, search, selectedStatuses]);

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
      formData.set("contact_email", application.contact_email ?? "");
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
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or company"
              className="w-64 rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
            />
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
                const nextFollowupLabel = app.next_followup_at
                  ? formatDateUk(app.next_followup_at)
                  : "";
                const isDue = isFollowupDue(app.next_followup_at);
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
                      </div>
                      {nextFollowupLabel ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isDue
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          Follow-up {nextFollowupLabel}
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
                      <Button
                        type="button"
                        variant="secondary"
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
    </div>
  );
}
