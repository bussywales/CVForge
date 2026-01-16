"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { CommandCentreItem } from "@/lib/applications-command-centre";
import {
  applicationStatusLabels,
  normaliseApplicationStatus,
} from "@/lib/application-status";

type Props = {
  items: CommandCentreItem[];
};

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-indigo-100 text-indigo-700",
  applied: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  interviewing: "bg-amber-100 text-amber-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  on_hold: "bg-slate-200 text-slate-700",
};

const filters: { id: ViewFilter; label: string }[] = [
  { id: "queue", label: "Queue" },
  { id: "drafts", label: "Drafts" },
  { id: "submitted", label: "Submitted" },
  { id: "interview", label: "Interview" },
  { id: "closed", label: "Closed" },
];

type ViewFilter = "queue" | "drafts" | "submitted" | "interview" | "closed";

export default function ApplicationsCommandCentre({ items }: Props) {
  const [view, setView] = useState<ViewFilter>("queue");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (view !== "queue") {
        if (
          (view === "drafts" && item.statusCategory !== "draft") ||
          (view === "submitted" && item.statusCategory !== "submitted") ||
          (view === "interview" && item.statusCategory !== "interview") ||
          (view === "closed" && item.statusCategory !== "closed")
        ) {
          return false;
        }
      }
      if (!term) return true;
      return (
        item.title.toLowerCase().includes(term) ||
        item.company.toLowerCase().includes(term)
      );
    });
  }, [items, view, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 rounded-full border border-black/10 bg-white/70 p-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setView(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                view === filter.id
                  ? "bg-[rgb(var(--accent))] text-white"
                  : "text-[rgb(var(--ink))]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search job title or company…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm md:max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          No matches. Try clearing search or switch view.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const status = normaliseApplicationStatus(item.status);
            const statusLabel = applicationStatusLabels[status] ?? status;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/80 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {item.title}
                    </p>
                    <p className="text-xs text-[rgb(var(--muted))]">
                      {item.company}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                        statusStyles[status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-700">
                      {item.progressLabel}
                    </span>
                    {item.followupDue ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-700">
                        Follow-up due
                      </span>
                    ) : null}
                    <span className="text-[10px] text-[rgb(var(--muted))]">
                      Updated {item.updatedLabel}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-left md:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                      Next action
                    </p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {item.nextActionLabel}
                    </p>
                  </div>
                  <Link
                    href={item.nextActionHref}
                    className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                  >
                    Go
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
