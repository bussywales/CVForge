"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { CommandCentreItem } from "@/lib/applications-command-centre";
import {
  applicationStatusLabels,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import { createFollowupFromTemplateAction } from "./actions";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildNextMove } from "@/lib/outreach-next-move";
import { getOutreachStageLabel } from "@/lib/outreach-utils";
import type { OutreachInsight } from "@/lib/outreach-insights";

type Props = {
  items: CommandCentreItem[];
  outreachInsight?: OutreachInsight | null;
  initialView?: ViewFilter;
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
  { id: "outreach", label: "Outreach" },
  { id: "drafts", label: "Drafts" },
  { id: "submitted", label: "Submitted" },
  { id: "interview", label: "Interview" },
  { id: "closed", label: "Closed" },
];

type ViewFilter = "queue" | "outreach" | "drafts" | "submitted" | "interview" | "closed";

export default function ApplicationsCommandCentre({ items, outreachInsight, initialView = "queue" }: Props) {
  const [view, setView] = useState<ViewFilter>(initialView);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (view === "outreach" && items[0]) {
      logMonetisationClientEvent("outreach_queue_view", items[0].id, "applications");
    }
  }, [items, view]);

  useEffect(() => {
    if (view === "outreach" && outreachInsight && items[0]) {
      logMonetisationClientEvent("outreach_insight_view", items[0].id, "applications", {
        replyRate: outreachInsight.replyRate,
      });
    }
  }, [items, outreachInsight, view]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (view !== "queue") {
          if (view === "outreach" && item.followupDueRank > 2) {
            return false;
          }
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
      })
      .sort((a, b) => {
        if (view === "outreach") {
          if (a.followupDueRank !== b.followupDueRank) {
            return a.followupDueRank - b.followupDueRank;
          }
        }
        return 0;
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
      ) : view === "outreach" ? (
        <div className="space-y-3">
          {outreachInsight ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    Outreach performance (14d)
                  </p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    Reply rate: {outreachInsight.replyRate}%
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() =>
                    logMonetisationClientEvent("outreach_insight_click", items[0]?.id, "applications")
                  }
                >
                  View tips
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[rgb(var(--muted))]">
                <span>Sent: {outreachInsight.sent}</span>
                <span>Replies: {outreachInsight.replies}</span>
                <span>Follow-ups: {outreachInsight.followups}</span>
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{outreachInsight.tip}</p>
            </div>
          ) : null}
          <OutreachList items={filtered} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <DefaultRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DefaultRow({ item }: { item: CommandCentreItem }) {
  const status = normaliseApplicationStatus(item.status);
  const statusLabel = applicationStatusLabels[status] ?? status;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.title}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{item.company}</p>
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
}

function OutreachList({ items }: { items: CommandCentreItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <OutreachRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function OutreachRow({ item }: { item: CommandCentreItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasEmail = Boolean(item.contactEmail);
  const hasLinkedIn = Boolean(item.contactLinkedin);
  const triageLabel = item.outreachStage
    ? getOutreachStageLabel(item.outreachStage)
    : null;
  const nextMove = buildNextMove({
    application: {
      ...item,
      outreach_stage: item.outreachStage ?? null,
      outreach_next_due_at: item.followupDueAt ?? null,
      next_followup_at: item.followupDueAt ?? null,
      next_action_due: item.followupDueAt ?? null,
      outcome_status: null,
    } as any,
    triage: item.outreachStage?.startsWith("triage_")
      ? item.outreachStage.replace("triage_", "")
      : null,
    hasCredits: false,
  });

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {item.title}
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">{item.company}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[rgb(var(--muted))]">
            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
              {item.followupStatus}
            </span>
            {triageLabel ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                {triageLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nextMove ? (
            <Link
              href={nextMove.href}
              className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-2 text-xs font-semibold text-white"
              onClick={() =>
                logMonetisationClientEvent("outreach_next_move_click", item.id, "applications", {
                  key: nextMove.key,
                })
              }
            >
              {nextMove.label}
            </Link>
          ) : null}
          <Link
            href={`/app/applications/${item.id}?tab=activity#outreach`}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
          >
            Open outreach
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!expanded) {
                logMonetisationClientEvent(
                  "outreach_queue_copy_log_open",
                  item.id,
                  "applications",
                  { stage: item.outreachStage }
                );
              }
              setExpanded((prev) => !prev);
            }}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
          >
            Copy + log
          </button>
          {hasEmail ? (
            <a
              href={
                item.outreachBody
                  ? `mailto:${item.contactEmail}?subject=${encodeURIComponent(item.outreachSubject ?? "Follow-up")}&body=${encodeURIComponent(item.outreachBody)}`
                  : `mailto:${item.contactEmail}`
              }
              onClick={() =>
                logMonetisationClientEvent(
                  "outreach_send_gmail",
                  item.id,
                  "applications",
                  { stage: item.outreachStage }
                )
              }
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Send (Gmail)
            </a>
          ) : (
            <Link
              href={`/app/applications/${item.id}?tab=activity#outreach`}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              onClick={() =>
                logMonetisationClientEvent(
                  "outreach_send_blocked_no_contact",
                  item.id,
                  "applications",
                  { stage: item.outreachStage }
                )
              }
            >
              Add contact
            </Link>
          )}
          {hasLinkedIn ? (
            <button
              type="button"
              onClick={() => {
                logMonetisationClientEvent(
                  "outreach_send_linkedin",
                  item.id,
                  "applications",
                  { stage: item.outreachStage }
                );
                window.open(item.contactLinkedin, "_blank", "noopener,noreferrer");
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Send (LinkedIn)
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-dashed border-black/10 bg-white/70 p-3 text-sm text-[rgb(var(--muted))]">
          {item.outreachSubject ? (
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {item.outreachSubject}
            </p>
          ) : null}
          <pre className="whitespace-pre-wrap text-xs">
            {item.outreachBody ?? "No template ready."}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLogForm item={item} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CopyLogForm({ item }: { item: CommandCentreItem }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
    const handleCopy = async () => {
      if (!item.outreachBody) return;
      try {
        await navigator.clipboard.writeText(item.outreachBody);
        setCopied(true);
        logMonetisationClientEvent("outreach_copy_click", item.id, "applications", {
          stage: item.outreachStage,
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("[outreach.queue.copy]", error);
      }
    };
  return (
    <form
      action={createFollowupFromTemplateAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={() => {
        logMonetisationClientEvent("outreach_queue_logged", item.id, "applications", {
          stage: item.outreachStage,
        });
        startTransition(() => {});
      }}
    >
      <input type="hidden" name="application_id" value={item.id} />
      <input type="hidden" name="subject" value={item.outreachSubject ?? ""} />
      <input type="hidden" name="body" value={item.outreachBody ?? ""} />
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
      >
        {copied ? "Copied" : "Copy message"}
      </button>
      <Button type="submit" disabled={pending}>
        Log sent
      </Button>
    </form>
  );
}
