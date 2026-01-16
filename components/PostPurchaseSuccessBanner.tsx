"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildReturnToUrl,
  clearPendingAction,
  loadPendingAction,
  type PendingAction,
} from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  show?: boolean;
  applicationId?: string;
  surface?: "billing" | "applications" | "practice";
  subscriptionStatus?: string | null;
};

export default function PostPurchaseSuccessBanner({
  show = false,
  applicationId,
  surface = "billing",
  subscriptionStatus,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [hidden, setHidden] = useState(false);
  const [resumeMode, setResumeMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resuming, setResuming] = useState(false);
  const [isSubscription, setIsSubscription] = useState(false);
  const [successOnly, setSuccessOnly] = useState(false);

  const pendingHref = useMemo(() => {
    if (!pending) return null;
    const url = new URL(buildReturnToUrl(pending), "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  }, [pending]);

  const markWatchdogStart = useCallback(
    (action: PendingAction, href: string, auto: boolean) => {
      if (typeof window === "undefined") return;
      const payload = {
        applicationId: action.applicationId,
        actionKey: action.type,
        href,
        startedAt: Date.now(),
        auto,
        subscription: isSubscription,
      };
      try {
        window.sessionStorage.setItem("cvf-watchdog-pending", JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("cvf-watchdog-start", { detail: payload }));
    },
    [isSubscription]
  );

  const handleResume = useCallback(
    (auto = false) => {
      if (!pending || !pendingHref || resuming) return;
      setResuming(true);
      setCountdown(null);
      clearPendingAction();
      setPending(null);
      setHidden(true);
      markWatchdogStart(pending, pendingHref, auto);
      if (isSubscription) {
        if (auto) {
          logMonetisationClientEvent(
            "sub_post_purchase_auto_redirect",
            pending.applicationId,
            surface,
            { actionKey: pending.type }
          );
        } else {
          logMonetisationClientEvent(
            "sub_post_purchase_resume_click",
            pending.applicationId,
            surface,
            { actionKey: pending.type }
          );
        }
      }
      logMonetisationClientEvent(
        "billing_success_banner_resume_click",
        pending.applicationId,
        surface,
        { actionKey: pending.type, auto }
      );
      logMonetisationClientEvent("resume_clicked", pending.applicationId, surface, {
        actionKey: pending.type,
        auto,
      });
      const eventNameMap: Record<PendingAction["type"], string> = {
        autopack_generate: "cvf-resume-autopack",
        interview_pack_export: "cvf-resume-interview-pack",
        application_kit_download: "cvf-resume-kit",
        answer_pack_generate: "cvf-resume-answer-pack",
      };
      router.push(pendingHref);
      const eventName = eventNameMap[pending.type];
      if (eventName) {
        window.dispatchEvent(
          new CustomEvent(eventName, {
            detail: pending,
          })
        );
      }
    },
    [pending, pendingHref, resuming, router, surface, markWatchdogStart, isSubscription]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams ?? undefined);
    const resumeRequested = params.get("resume") === "1";
    const success =
      show ||
      params.has("success") ||
      params.has("purchased") ||
      params.get("checkout") === "success" ||
      resumeRequested;
    const subscriptionFlag =
      params.get("mode") === "subscription" ||
      params.get("sub") === "1" ||
      Boolean(params.get("planKey")) ||
      Boolean(subscriptionStatus && subscriptionStatus !== "canceled");
    setIsSubscription(subscriptionFlag);

    if (!success) return;

    const nextPending = loadPendingAction();
    if (
      nextPending &&
      (!applicationId || nextPending.applicationId === applicationId)
    ) {
      const sessionId = params.get("session_id") || "success";
      const guardKey = `pp_success_seen:${sessionId}:${nextPending.type}:${nextPending.applicationId}:${resumeRequested ? "resume" : "return"}`;
      if (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(guardKey) &&
        !pending
      ) {
        setHidden(true);
        return;
      }
      setPending(nextPending);
      setHidden(false);
      setResumeMode(resumeRequested);
      if (resumeRequested) {
        setCountdown((prev) => (prev === null ? 3 : prev));
        logMonetisationClientEvent(
          "resume_banner_shown",
          nextPending.applicationId,
          surface,
          { actionKey: nextPending.type }
        );
        if (subscriptionFlag) {
          logMonetisationClientEvent(
            "sub_post_purchase_auto_redirect",
            nextPending.applicationId,
            surface,
            { actionKey: nextPending.type, countdown: true }
          );
        }
      } else {
        setCountdown(null);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(guardKey, "1");
      }
      if (subscriptionFlag) {
        logMonetisationClientEvent(
          "sub_post_purchase_view",
          nextPending.applicationId,
          surface,
          { actionKey: nextPending.type, resume: resumeRequested }
        );
      }
      logMonetisationClientEvent(
        "billing_success_banner_view",
        nextPending.applicationId,
        surface,
        { actionKey: nextPending.type, resume: resumeRequested }
      );
    } else {
      setSuccessOnly(true);
      setHidden(false);
      if (subscriptionFlag && applicationId) {
        logMonetisationClientEvent("sub_post_purchase_view", applicationId, surface, {
          actionKey: "none",
          resume: false,
        });
      }
    }
  }, [searchParams, show, applicationId, surface, pending, subscriptionStatus]);

  useEffect(() => {
    if (!resumeMode || countdown === null || resuming) return;
    if (countdown <= 0) {
      handleResume(true);
      return;
    }
    const timer = window.setTimeout(
      () => setCountdown((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resumeMode, countdown, resuming, handleResume]);

  if (successOnly && !hidden) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {isSubscription ? "Subscription active." : "Payment successful."}
            </p>
            <p className="text-xs text-emerald-700">
              {isSubscription
                ? "You can keep going without running out of credits."
                : "You’re all set."}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => setHidden(true)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!pending || !pendingHref || hidden) return null;

  const actionLabels: Record<PendingAction["type"], string> = {
    autopack_generate: "Generate Autopack",
    interview_pack_export: "Export Interview Pack",
    application_kit_download: "Download Application Kit",
    answer_pack_generate: "Generate Answer Pack",
  };
  const subtitle =
    resumeMode && countdown !== null
      ? `Auto-resuming in ${countdown}s…`
      : "We saved your last step. Resume when you’re ready.";
  const title = isSubscription
    ? "Subscription active — resuming your next step…"
    : "Resume Accelerator ready.";

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            {title}
          </p>
          <p className="text-xs text-emerald-700">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            onClick={() => handleResume()}
          >
            {resumeMode && countdown !== null
              ? `Resuming in ${countdown}s`
              : `Resume: ${actionLabels[pending.type]}`}
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => {
              setHidden(true);
              setResumeMode(false);
              setCountdown(null);
              setPending(null);
              clearPendingAction();
              if (isSubscription) {
                logMonetisationClientEvent(
                  "sub_post_purchase_not_now",
                  pending.applicationId,
                  surface,
                  { actionKey: pending.type }
                );
              }
              logMonetisationClientEvent(
                "billing_success_banner_dismiss",
                pending.applicationId,
                surface,
                { actionKey: pending.type }
              );
              logMonetisationClientEvent(
                "resume_dismissed",
                pending.applicationId,
                surface,
                { actionKey: pending.type }
              );
            }}
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
