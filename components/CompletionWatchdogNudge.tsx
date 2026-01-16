"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type WatchPayload = {
  applicationId: string;
  actionKey: string;
  href: string;
  startedAt: number;
  auto?: boolean;
  subscription?: boolean;
};

type Props = {
  applicationId: string;
  surface?: string;
  fallbackHref?: string;
};

const STORAGE_KEY = "cvf-watchdog-pending";

export default function CompletionWatchdogNudge({
  applicationId,
  surface = "applications",
  fallbackHref = "",
}: Props) {
  const [payload, setPayload] = useState<WatchPayload | null>(null);
  const [show, setShow] = useState(false);

  const href = useMemo(() => payload?.href ?? fallbackHref ?? "", [payload, fallbackHref]);

  useEffect(() => {
    const load = () => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as WatchPayload;
        if (!parsed?.applicationId || parsed.applicationId !== applicationId) return;
        setPayload(parsed);
      } catch {
        /* ignore */
      }
    };
    load();
    const startHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as WatchPayload;
      if (!detail?.applicationId || detail.applicationId !== applicationId) return;
      setPayload(detail);
      setShow(false);
    };
    const completeHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { applicationId?: string } | undefined;
      if (detail?.applicationId !== applicationId) return;
      if (payload?.subscription) {
        logMonetisationClientEvent(
          "sub_completion_nudge_completed",
          applicationId,
          surface,
          { actionKey: payload.actionKey }
        );
      }
      setShow(false);
      setPayload(null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    };
    window.addEventListener("cvf-watchdog-start", startHandler);
    window.addEventListener("cvf-action-completed", completeHandler);
    return () => {
      window.removeEventListener("cvf-watchdog-start", startHandler);
      window.removeEventListener("cvf-action-completed", completeHandler);
    };
  }, [applicationId, payload, surface]);

  useEffect(() => {
    if (!payload) return;
    const deadline = payload.startedAt + 90_000;
    const remaining = Math.max(deadline - Date.now(), 0);
    const timer = window.setTimeout(() => {
      setShow(true);
      if (payload.subscription) {
        logMonetisationClientEvent(
          "sub_completion_nudge_view",
          applicationId,
          surface,
          { actionKey: payload.actionKey }
        );
      }
      logMonetisationClientEvent(
        "completion_watchdog_view",
        applicationId,
        surface,
        { actionKey: payload.actionKey }
      );
    }, remaining || 1);
    return () => window.clearTimeout(timer);
  }, [applicationId, payload, surface]);

  if (!payload || !show || !href) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Quick check: did you finish the step you unlocked?</p>
          <p className="text-xs text-amber-700">
            If not, jump back to the exact spot and complete it now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="rounded-full bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          onClick={() =>
            logMonetisationClientEvent(
              "completion_watchdog_back_click",
              applicationId,
              surface,
              { actionKey: payload.actionKey }
            )
          }
        >
          Take me back
        </Link>
          <button
            type="button"
            className="rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              setShow(false);
              setPayload(null);
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(STORAGE_KEY);
              }
              if (payload.subscription) {
                logMonetisationClientEvent(
                  "sub_completion_nudge_dismiss",
                  applicationId,
                  surface,
                  { actionKey: payload.actionKey, action: "mark_done" }
                );
              }
              logMonetisationClientEvent(
                "completion_watchdog_mark_done",
                applicationId,
                surface,
                { actionKey: payload.actionKey }
              );
            }}
          >
            Mark as done
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              setShow(false);
              setPayload(null);
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(STORAGE_KEY);
              }
              if (payload.subscription) {
                logMonetisationClientEvent(
                  "sub_completion_nudge_dismiss",
                  applicationId,
                  surface,
                  { actionKey: payload.actionKey, action: "dismiss" }
                );
              }
              logMonetisationClientEvent(
                "completion_watchdog_dismiss",
                applicationId,
                surface,
                { actionKey: payload.actionKey }
              );
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
