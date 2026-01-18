"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { InterviewFocusItem } from "@/lib/interview-focus";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type InterviewFocusCardProps = {
  applicationId: string;
  weekKey: string;
  items: InterviewFocusItem[];
};

export default function InterviewFocusCard({
  applicationId,
  weekKey,
  items,
}: InterviewFocusCardProps) {
  const storageKey = useMemo(
    () => `cvf:interview_focus_done:${applicationId}:${weekKey}`,
    [applicationId, weekKey]
  );
  const [doneKeys, setDoneKeys] = useState<string[]>([]);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDoneKeys(parsed);
        }
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (!items.length) return;
    logMonetisationClientEvent("interview_focus_view", applicationId, "applications", {
      weekKey,
      keys: items.map((item) => item.key),
    });
  }, [applicationId, items, weekKey]);

  const allDone = items.length > 0 && items.every((item) => doneKeys.includes(item.key));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(doneKeys));
  }, [doneKeys, storageKey]);

  useEffect(() => {
    if (allDone) {
      logMonetisationClientEvent(
        "interview_focus_session_complete",
        applicationId,
        "applications",
        { weekKey }
      );
    }
  }, [allDone, applicationId, weekKey]);

  const toggleDone = (key: string, value: boolean) => {
    setDoneKeys((prev) => {
      const next = value ? Array.from(new Set([...prev, key])) : prev.filter((item) => item !== key);
      logMonetisationClientEvent(
        value ? "interview_focus_mark_done" : "interview_focus_undo",
        applicationId,
        "applications",
        { key, weekKey }
      );
      return next;
    });
  };

  const visibleItems = showList ? items : [];

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Today&apos;s Focus (15 mins)
          </p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Jump to the answers that will move you fastest.
          </p>
        </div>
        {items.length ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            {weekKey}
          </span>
        ) : null}
      </div>

      {allDone ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Session complete</p>
          <p className="mt-1 text-sm text-emerald-700">
            Nice work — these answers are covered for the week.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setDoneKeys([]);
                setShowList(true);
                logMonetisationClientEvent(
                  "interview_focus_add_one_more",
                  applicationId,
                  "applications",
                  { weekKey }
                );
              }}
            >
              Add one more step
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowList(false);
                logMonetisationClientEvent(
                  "interview_focus_leave_it",
                  applicationId,
                  "applications",
                  { weekKey }
                );
              }}
            >
              Leave it there
            </Button>
          </div>
        </div>
      ) : null}

      {!items.length ? (
        <p className="mt-4 text-sm text-[rgb(var(--muted))]">
          No interview focus items yet. Add drafts to your Interview Pack to see recommendations.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {visibleItems.map((item) => {
          const isDone = doneKeys.includes(item.key);
          return (
            <div
              key={item.key}
              className={`rounded-2xl border p-4 ${
                isDone
                  ? "border-emerald-100 bg-emerald-50 opacity-90"
                  : "border-black/10 bg-white/70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        item.quality === "Strong"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.quality === "Solid"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.quality}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                      Focus
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {item.label}
                  </p>
                  <p className="text-sm text-[rgb(var(--muted))]">{item.reason}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    Next improvement: {item.nextStep}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={item.href}
                    className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white"
                    onClick={() =>
                      logMonetisationClientEvent(
                        "interview_focus_open_click",
                        applicationId,
                        "applications",
                        { key: item.key, weekKey }
                      )
                    }
                  >
                    Open
                  </Link>
                  {isDone ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold">
                        Done
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleDone(item.key, false)}
                        className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleDone(item.key, true)}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
