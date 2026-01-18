"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { INTERVIEW_SESSION_COPY } from "@/lib/microcopy/interview";
import { buildSessionCtaLabel, type InterviewFocusSession } from "@/lib/interview-focus-session";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string;
  weekKey: string;
  session: InterviewFocusSession;
};

export default function InterviewFocusSessionCard({ applicationId, weekKey, session }: Props) {
  const storageKey = useMemo(
    () => `cvf:interview_session:${applicationId}:${weekKey}:${session.sessionId}`,
    [applicationId, session.sessionId, weekKey]
  );
  const [readyKeys, setReadyKeys] = useState<string[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { ready: string[]; started?: boolean };
        setReadyKeys(parsed.ready ?? []);
        setStarted(Boolean(parsed.started));
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ ready: readyKeys, started });
    window.localStorage.setItem(storageKey, payload);
  }, [readyKeys, started, storageKey]);

  useEffect(() => {
    logMonetisationClientEvent("interview_session_view", applicationId, "applications", {
      weekKey,
      questions: session.questions.map((q) => q.key),
    });
  }, [applicationId, session.questions, weekKey]);

  const total = session.questions.length;
  const readyCount = readyKeys.length;
  const complete = total > 0 && readyCount >= total;

  useEffect(() => {
    if (complete) {
      logMonetisationClientEvent("interview_session_complete", applicationId, "applications", {
        weekKey,
      });
    }
  }, [applicationId, complete, weekKey]);

  const handleReady = (key: string, value: boolean) => {
    setReadyKeys((prev) => {
      const next = value ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key);
      logMonetisationClientEvent(
        value ? "interview_session_mark_ready" : "interview_session_undo",
        applicationId,
        "applications",
        { key, weekKey }
      );
      if (!started) {
        setStarted(true);
        logMonetisationClientEvent("interview_session_start", applicationId, "applications", {
          weekKey,
        });
      }
      return next;
    });
  };

  const copyAll = async () => {
    const text = session.questions
      .map((q, idx) => {
        const answer = q.answerText ? `\n${q.answerText}` : "";
        return `${idx + 1}. ${q.label}${answer}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      logMonetisationClientEvent("interview_session_copy_all", applicationId, "applications", {
        weekKey,
      });
    } catch {
      /* ignore */
    }
  };

  const sections = [
    { label: "Do now", items: session.questions.slice(0, 2) },
    { label: "Up next", items: session.questions.slice(2, 4) },
    { label: "If time", items: session.questions.slice(4) },
  ];

  return (
    <div
      id="interview-focus-session"
      className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
            {INTERVIEW_SESSION_COPY.TITLE}
          </p>
          <p className="text-sm text-[rgb(var(--muted))]">
            {INTERVIEW_SESSION_COPY.SUBTITLE}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {session.estimatedMinutes} mins
          </span>
          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
            {readyCount}/{total} ready
          </span>
        </div>
      </div>

      {complete ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">{INTERVIEW_SESSION_COPY.COMPLETE_TITLE}</p>
          <p className="mt-1 text-sm text-emerald-700">{INTERVIEW_SESSION_COPY.COMPLETE_BODY}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
              onClick={copyAll}
            >
              {INTERVIEW_SESSION_COPY.COPY_ALL}
            </button>
            <Link
              href={`/app/applications/${applicationId}?tab=interview#answer-pack`}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              {INTERVIEW_SESSION_COPY.OPEN_ANSWER_PACK}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {sections.map((section) =>
          section.items.length ? (
            <div key={section.label} className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                {section.label}
              </p>
              {section.items.map((item) => {
                const isReady = readyKeys.includes(item.key);
                const ctaLabel = buildSessionCtaLabel(item.quality, isReady);
                return (
                  <div
                    key={item.key}
                    className={`rounded-2xl border p-4 ${
                      isReady
                        ? "border-emerald-100 bg-emerald-50"
                        : "border-black/10 bg-white/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
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
                          <span className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                            {item.reason}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.label}</p>
                        <p className="text-xs text-[rgb(var(--muted))]">Next improvement: {item.qualityHint}</p>
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
                          {ctaLabel}
                        </Link>
                        {isReady ? (
                          <button
                            type="button"
                            onClick={() => handleReady(item.key, false)}
                            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                          >
                            {INTERVIEW_SESSION_COPY.UNDO}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReady(item.key, true)}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                          >
                            {INTERVIEW_SESSION_COPY.MARK_READY}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
